/**
 * Integration tests for cooks: the first cooks, filing posts by tag, forking,
 * and "a fork does not go live until its payment is executed".
 * In-memory SQLite; on-chain logging and the server wallet are mocked.
 */

import { PrivateKey } from "@bsv/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/bsv/onchain", () => ({
  logPostOnChain: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/services/bsv/anchor-sweep", () => ({
  sweepOrphans: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/fairness/boot-orchestrator", () => ({
  executeBoot: vi.fn(),
}));
vi.mock("@/services/bsv/wallet", () => ({
  isServerSpendDisabled: vi.fn().mockReturnValue(false),
  getServerAddress: vi.fn().mockReturnValue(null),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map([["x-forwarded-for", "10.0.0.9"]])),
}));

import { COOK_SEEDS } from "@/data/cooks-seed";
import { forkPostText, spawnMessage } from "@/lib/cooks";
import { seedCooks } from "@/lib/cooks-db";
import { db } from "@/lib/db";
import { activateFork, createPost, getCookPosts, getCookStatus, getCooks } from "./actions";

function sign(key: PrivateKey, message: string): string {
  return key.sign(Array.from(new TextEncoder().encode(message))).toDER("hex") as string;
}

let keyCounter = 0;
/** Post as a fresh account each time (keeps the per-account rate limit out of the way). */
async function postAs(content: string, key = PrivateKey.fromRandom()) {
  keyCounter++;
  const fd = new FormData();
  fd.set("content", content);
  fd.set("author", `anon_t${keyCounter}`);
  fd.set("pubkey", key.toPublicKey().toString());
  fd.set("signature", sign(key, content));
  const result = await createPost(fd);
  const row = db.prepare("SELECT id FROM posts ORDER BY id DESC LIMIT 1").get() as { id: number };
  return { result, id: row.id };
}

let txCounter = 0;
/** Record a boost the way /api/boot-confirm does: a bootboard row plus payouts under one txid. */
function recordBoost(postId: number, payerAddress: string, opts: { free?: boolean } = {}): string {
  txCounter++;
  const txid = txCounter.toString(16).padStart(64, "0");
  const boot = db
    .prepare(
      "INSERT INTO bootboard (post_id, boosted_by, boosted_by_name, is_free) VALUES (?,?,?,?)"
    )
    .run(postId, payerAddress, "anon_pay", opts.free ? 1 : 0);
  db.prepare(
    "INSERT INTO payouts (boot_event_id, recipient_pubkey, recipient_address, amount_sats, payout_type, txid) VALUES (?,?,?,?,?,?)"
  ).run(boot.lastInsertRowid, "pk", "1Recipient", 1000, "pool_share", txid);
  return txid;
}

function activate(cookId: string, txid: string, payer: PrivateKey, signer = payer) {
  return activateFork(
    cookId,
    txid,
    payer.toPublicKey().toString(),
    sign(signer, spawnMessage(cookId, txid))
  );
}

/** A live parent cook with one founding post. */
function makeParent(): number {
  const founder = db
    .prepare(
      "INSERT INTO posts (content, author_name, pubkey, created_at) VALUES ('the first idea', 'anon_og', 'pk_og', '2026-03-01 00:00:00')"
    )
    .run().lastInsertRowid as number;
  db.prepare(
    "INSERT INTO cooks (id, name, kind, founder_post_id, created_at) VALUES ('froge', 'Froge', 'Cook', ?, '2026-03-01 00:00:00')"
  ).run(founder);
  db.prepare("INSERT INTO cook_posts (post_id, cook_id) VALUES (?, 'froge')").run(founder);
  return founder;
}

describe("cooks — integration", () => {
  beforeEach(() => {
    for (const table of ["payouts", "bootboard", "cook_posts", "cooks", "posts"]) {
      db.exec(`DELETE FROM ${table}`);
    }
    vi.clearAllMocks();
  });

  it("seeds the first cooks and files only posts that exist and predate the list", () => {
    // Post 27 exists and is old; post 28 exists but was made AFTER the list (a
    // local test post that merely reuses the number) and must not be filed.
    db.prepare(
      "INSERT INTO posts (id, content, author_name, created_at) VALUES (27, 'https://therealbitcoin.fun/', 'anon_a', '2026-02-24 19:13:00')"
    ).run();
    db.prepare(
      "INSERT INTO posts (id, content, author_name, created_at) VALUES (28, 'unrelated new post', 'anon_b', '2026-12-01 00:00:00')"
    ).run();

    expect(seedCooks(db)).toBe(1);
    expect(seedCooks(db)).toBe(0); // idempotent

    const filed = db.prepare("SELECT post_id, cook_id FROM cook_posts").all();
    expect(filed).toEqual([{ post_id: 27, cook_id: "therealbitcoinfun" }]);
    const count = db.prepare("SELECT COUNT(*) c FROM cooks").get() as { c: number };
    expect(count.c).toBe(COOK_SEEDS.length);
  });

  it("lists live cooks, most recently active first, with their posts in chat order", async () => {
    makeParent();
    const a = await postAs("OCfroge add a hat");
    const b = await postAs("OCfroge and boots");
    await postAs("no tag here");
    expect(a.result).toEqual({ ok: true });

    const cooks = await getCooks();
    expect(cooks).toHaveLength(1);
    expect(cooks[0]).toMatchObject({ id: "froge", name: "Froge", postCount: 3, lastPostId: b.id });
    expect(cooks[0].recentPostIds[0]).toBe(b.id);

    const posts = await getCookPosts("froge");
    expect(posts.map((p) => p.content)).toEqual([
      "the first idea",
      "OCfroge add a hat",
      "OCfroge and boots",
    ]);
    // Any spelling of the tag reaches the same cook.
    expect(await getCookPosts("OCFroge.")).toHaveLength(3);
    expect(await getCookPosts("nope")).toEqual([]);
  });

  it("a tag for a cook that does not exist starts nothing", async () => {
    makeParent();
    await postAs("OCbrandnew my idea");
    expect(await getCooks()).toHaveLength(1);
    expect(await getCookStatus("brandnew")).toBeNull();
  });

  it("a fork is created waiting, is not listed, and goes live only once paid", async () => {
    const founder = makeParent();
    const forker = PrivateKey.fromRandom();
    const forkerAddress = forker.toPublicKey().toAddress().toString();

    await postAs(forkPostText("FrogRun", "Froge", "an endless runner"));
    expect(await getCookStatus("frogrun")).toEqual({
      id: "frogrun",
      name: "FrogRun",
      status: "pending",
      parentId: "froge",
      parentName: "Froge",
      payPostId: founder,
    });
    expect((await getCooks()).map((c) => c.id)).toEqual(["froge"]); // not listed yet

    // No payment recorded → stays waiting.
    expect(await activate("frogrun", "f".repeat(64), forker)).toEqual({
      ok: false,
      reason: "no_payment",
    });

    const txid = recordBoost(founder, forkerAddress);
    expect(await activate("frogrun", txid, forker)).toEqual({ ok: true });
    expect((await getCookStatus("frogrun"))?.status).toBe("live");

    const cooks = await getCooks();
    expect(cooks.map((c) => c.id)).toEqual(["frogrun", "froge"]);
    expect(cooks[0]).toMatchObject({ kind: "Fork of Froge", parentId: "froge", postCount: 1 });
    expect(cooks[0].pitch).toBe("an endless runner");
    // Asking again after a dropped reply is harmless.
    expect(await activate("frogrun", txid, forker)).toEqual({ ok: true });
  });

  it("refuses payments that are not a real, own, paid boost of the parent's founding post", async () => {
    const founder = makeParent();
    const other = db
      .prepare("INSERT INTO posts (content, author_name) VALUES ('another post', 'anon_x')")
      .run().lastInsertRowid as number;
    const forker = PrivateKey.fromRandom();
    const forkerAddress = forker.toPublicKey().toAddress().toString();
    const stranger = PrivateKey.fromRandom();
    const strangerAddress = stranger.toPublicKey().toAddress().toString();

    // A boost made BEFORE the fork existed cannot be reused.
    const early = recordBoost(founder, forkerAddress);
    db.prepare("UPDATE bootboard SET booted_at = '2026-01-01 00:00:00'").run();
    await postAs(forkPostText("FrogRun", "Froge", ""));
    expect(await activate("frogrun", early, forker)).toEqual({ ok: false, reason: "too_old" });

    // A boost of some other post.
    expect(await activate("frogrun", recordBoost(other, forkerAddress), forker)).toEqual({
      ok: false,
      reason: "wrong_post",
    });
    // A server-funded free boost is not a payment.
    expect(
      await activate("frogrun", recordBoost(founder, forkerAddress, { free: true }), forker)
    ).toEqual({ ok: false, reason: "not_paid" });
    // Somebody else's boost: the forker can sign, but did not pay it.
    const theirs = recordBoost(founder, strangerAddress);
    expect(await activate("frogrun", theirs, forker)).toEqual({ ok: false, reason: "wrong_payer" });
    // Claiming to be the payer without their key.
    expect(await activate("frogrun", theirs, stranger, forker)).toEqual({
      ok: false,
      reason: "invalid_signature",
    });
    expect(await activateFork("frogrun", "zz", "nope", "00")).toEqual({
      ok: false,
      reason: "bad_input",
    });
    expect((await getCookStatus("frogrun"))?.status).toBe("pending");
  });

  it("one payment takes one fork live, not two", async () => {
    const founder = makeParent();
    const forker = PrivateKey.fromRandom();
    const forkerAddress = forker.toPublicKey().toAddress().toString();
    await postAs(forkPostText("FrogRun", "Froge", ""));
    await postAs(forkPostText("FrogSwim", "Froge", ""));

    const txid = recordBoost(founder, forkerAddress);
    expect(await activate("frogrun", txid, forker)).toEqual({ ok: true });
    expect(await activate("frogswim", txid, forker)).toEqual({ ok: false, reason: "used" });
    expect((await getCookStatus("frogswim"))?.status).toBe("pending");
    // A second, separate payment does it.
    expect(await activate("frogswim", recordBoost(founder, forkerAddress), forker)).toEqual({
      ok: true,
    });
  });

  it("a fork needs a parent that exists, and a taken name just files the post", async () => {
    makeParent();
    await postAs("OCghost fork of OCnowhere\nno such parent");
    expect(await getCookStatus("ghost")).toBeNull();

    // `froge` already exists: this is an ordinary post into froge, not a new cook.
    await postAs("OCfroge fork of OCfroge");
    expect((await getCooks()).map((c) => c.id)).toEqual(["froge"]);
    expect(await getCookPosts("froge")).toHaveLength(2);
  });
});
