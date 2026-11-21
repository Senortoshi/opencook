/**
 * Integration tests for cooks: the first cooks, and filing posts by tag.
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
import { seedCooks } from "@/lib/cooks-db";
import { db } from "@/lib/db";
import { createPost, getCookPosts, getCooks } from "./actions";

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
  });

  it("a fork-style post starts no cook in this version", async () => {
    makeParent();
    await postAs("OCfrogrun fork of OCfroge\nan endless runner");
    expect((await getCooks()).map((c) => c.id)).toEqual(["froge"]);
    expect(await getCookPosts("frogrun")).toEqual([]);
    // It is still an ordinary post in the main feed, not filed under the parent.
    expect(await getCookPosts("froge")).toHaveLength(1);
  });
});
