/**
 * Cooks — storage. SERVER-ONLY (takes a better-sqlite3 handle).
 *
 * Two tables, both a rebuildable INDEX over what is already on-chain in post
 * text (see lib/cooks.ts), never a source of truth for money:
 *   - `cooks`       one row per cook: its id (normalized tag), display name,
 *                   optional pitch / link / lesson, the cook it forked from,
 *                   and the post that founded it.
 *   - `cook_posts`  which cook a post is filed under (a post is in at most one).
 *
 * Deliberately NOT here: any payout or split. Paying a cook is a separate,
 * undecided piece (owner call) and nothing in this file moves or assigns money.
 */

import { COOK_SEEDS, CURATED_BEFORE } from "@/data/cooks-seed";
import type { Cook, Post } from "@/types";
import { cookIdFrom, parseCookPost } from "./cooks";

type Db = import("better-sqlite3").Database;

/** Most posts one cook view loads (chat order, newest kept). */
export const COOK_POSTS_MAX = 500;
/** Most recent post ids returned per cook for the menu's unread counts. */
const RECENT_IDS_MAX = 200;

export function ensureCookTables(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'Cook',
      pitch TEXT,
      live_url TEXT,
      lesson TEXT,
      parent_id TEXT,
      founder_post_id INTEGER,
      status TEXT NOT NULL DEFAULT 'live',
      activation_txid TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // A database that got an earlier shape of this table (no status columns)
  // is brought up to date; CREATE TABLE IF NOT EXISTS alone would not do it.
  const columns = new Set(
    (db.prepare("PRAGMA table_info(cooks)").all() as { name: string }[]).map((c) => c.name)
  );
  if (!columns.has("status")) {
    db.exec("ALTER TABLE cooks ADD COLUMN status TEXT NOT NULL DEFAULT 'live'");
  }
  if (!columns.has("activation_txid")) {
    db.exec("ALTER TABLE cooks ADD COLUMN activation_txid TEXT");
  }
  // One payment can take ONE fork live.
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_cooks_activation ON cooks(activation_txid) WHERE activation_txid IS NOT NULL"
  );
  db.exec(`
    CREATE TABLE IF NOT EXISTS cook_posts (
      post_id INTEGER PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
      cook_id TEXT NOT NULL
    )
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_cook_posts_cook ON cook_posts(cook_id, post_id)");
}

/**
 * Create the first cooks and file their (untagged, pre-existing) posts.
 * Additive and idempotent: never changes a cook that exists, never re-files a
 * post that is already filed, and skips post numbers that don't exist here or
 * were created after the list was made. Returns how many posts it filed.
 */
export function seedCooks(db: Db): number {
  const addCook = db.prepare(
    "INSERT OR IGNORE INTO cooks (id, name, kind, pitch, live_url, lesson, parent_id, founder_post_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const eligible = db.prepare("SELECT id FROM posts WHERE id = ? AND created_at < ?");
  const file = db.prepare("INSERT OR IGNORE INTO cook_posts (post_id, cook_id) VALUES (?, ?)");
  let filed = 0;
  db.transaction(() => {
    for (const seed of COOK_SEEDS) {
      const present = seed.postIds.filter((id) => eligible.get(id, CURATED_BEFORE));
      addCook.run(
        seed.id,
        seed.name,
        seed.kind,
        seed.pitch ?? null,
        seed.liveUrl ?? null,
        seed.lesson ?? null,
        seed.parent ?? null,
        present[0] ?? null
      );
      for (const id of present) filed += file.run(id, seed.id).changes;
    }
  })();
  return filed;
}

/**
 * File a NEW post by the tag at the start of its text, creating the cook when
 * the post is a valid fork (`OCnew fork of OCparent`). Call inside the same
 * transaction that inserts the post. Returns what happened, for tests.
 *
 * A fork is created PENDING and goes live only once paid for.
 *
 * A tag for a cook that does not exist files nothing: starting a brand-new
 * cook from nothing is not open yet (it is meant to cost something — owner
 * decision pending), so only forks of an existing cook create one.
 */
export function fileNewPost(
  db: Db,
  postId: number,
  content: string
): { cookId: string; created: boolean } | null {
  const parsed = parseCookPost(content);
  if (!parsed) return null;
  const exists = (id: string) => !!db.prepare("SELECT 1 FROM cooks WHERE id = ?").get(id);

  let created = false;
  if (!exists(parsed.cookId)) {
    if (!parsed.forkOf || !exists(parsed.forkOf)) return null;
    const parent = db.prepare("SELECT name FROM cooks WHERE id = ?").get(parsed.forkOf) as {
      name: string;
    };
    // A fork starts PENDING: it is not listed and has no feed until a payment
    // is executed for it (see `activateCook`).
    db.prepare(
      "INSERT INTO cooks (id, name, kind, pitch, parent_id, founder_post_id, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')"
    ).run(
      parsed.cookId,
      parsed.name,
      `Fork of ${parent.name}`,
      parsed.pitch || null,
      parsed.forkOf,
      postId
    );
    created = true;
  }
  db.prepare("INSERT OR IGNORE INTO cook_posts (post_id, cook_id) VALUES (?, ?)").run(
    postId,
    parsed.cookId
  );
  return { cookId: parsed.cookId, created };
}

interface CookRow {
  id: string;
  name: string;
  kind: string;
  pitch: string | null;
  live_url: string | null;
  lesson: string | null;
  parent_id: string | null;
  parent_name: string | null;
  founder_post_id: number | null;
  created_at: string;
  post_count: number;
  last_post_id: number | null;
  last_active: string | null;
  boot_count: number;
}

/** Every cook, most recently active first, with what the menu needs. */
export function listCooks(db: Db): Cook[] {
  const rows = db
    .prepare(`
      SELECT c.*, parent.name AS parent_name,
        COUNT(cp.post_id) AS post_count,
        MAX(cp.post_id) AS last_post_id,
        MAX(p.created_at) AS last_active,
        COALESCE(SUM((SELECT COUNT(*) FROM bootboard b WHERE b.post_id = cp.post_id)), 0) AS boot_count
      FROM cooks c
      LEFT JOIN cooks parent ON parent.id = c.parent_id
      LEFT JOIN cook_posts cp ON cp.cook_id = c.id
      LEFT JOIN posts p ON p.id = cp.post_id
      WHERE c.status = 'live'
      GROUP BY c.id
      ORDER BY COALESCE(MAX(cp.post_id), 0) DESC, c.created_at DESC
    `)
    .all() as CookRow[];
  const recent = db.prepare(
    "SELECT post_id FROM cook_posts WHERE cook_id = ? ORDER BY post_id DESC LIMIT ?"
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    pitch: row.pitch,
    liveUrl: row.live_url,
    lesson: row.lesson,
    parentId: row.parent_id,
    parentName: row.parent_name,
    founderPostId: row.founder_post_id,
    createdAt: row.created_at,
    postCount: row.post_count,
    lastPostId: row.last_post_id,
    lastActive: row.last_active,
    bootCount: row.boot_count,
    recentPostIds: (recent.all(row.id, RECENT_IDS_MAX) as { post_id: number }[]).map(
      (r) => r.post_id
    ),
  }));
}

/** A cook's posts in chat order (oldest first); the newest COOK_POSTS_MAX. */
export function cookPosts(db: Db, cookId: string): Post[] {
  const id = cookIdFrom(cookId);
  if (!id) return [];
  const rows = db
    .prepare(`
      SELECT p.*, COALESCE(bc.boot_count, 0) as boot_count
      FROM cook_posts cp
      JOIN posts p ON p.id = cp.post_id
      LEFT JOIN (SELECT post_id, COUNT(*) as boot_count FROM bootboard GROUP BY post_id) bc
        ON bc.post_id = p.id
      WHERE cp.cook_id = ?
      ORDER BY p.id DESC
      LIMIT ?
    `)
    .all(id, COOK_POSTS_MAX) as Post[];
  return rows.reverse();
}

export interface CookStatus {
  id: string;
  name: string;
  status: "live" | "pending";
  parentId: string | null;
  parentName: string | null;
  /** The post a fork's payment must boost: the PARENT's founding post. */
  payPostId: number | null;
}

/** One cook's status (live or still waiting for payment). Null if unknown. */
export function cookStatus(db: Db, cookId: string): CookStatus | null {
  const id = cookIdFrom(cookId);
  if (!id) return null;
  const row = db
    .prepare(`
      SELECT c.id, c.name, c.status, c.parent_id, parent.name AS parent_name,
        parent.founder_post_id AS pay_post_id
      FROM cooks c LEFT JOIN cooks parent ON parent.id = c.parent_id
      WHERE c.id = ?
    `)
    .get(id) as
    | {
        id: string;
        name: string;
        status: string;
        parent_id: string | null;
        parent_name: string | null;
        pay_post_id: number | null;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    status: row.status === "live" ? "live" : "pending",
    parentId: row.parent_id,
    parentName: row.parent_name,
    payPostId: row.pay_post_id,
  };
}

export type ActivateResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "unknown_cook"
        | "no_payment"
        | "wrong_post"
        | "wrong_payer"
        | "not_paid"
        | "too_old"
        | "used";
    };

/**
 * Take a pending fork live — only against a RECORDED, PAID boost.
 *
 * `txid` must be a boost that `/api/boot-confirm` already verified and
 * recorded (so the money really moved, to the split the server checked), and:
 *   - it boosted the PARENT cook's founding post (the original author and the
 *     contributors are who got paid);
 *   - it was paid by `payerAddress` — the caller has already verified that this
 *     address signed `spawnMessage(cookId, txid)`;
 *   - it was a paid boost, not a server-funded free one;
 *   - it happened after the fork was created (an old boost can't be reused);
 *   - it has not already taken another fork live (unique index).
 * Already-live is success, so a retry after a dropped response is harmless.
 */
export function activateCook(
  db: Db,
  input: { cookId: string; txid: string; payerAddress: string }
): ActivateResult {
  const cook = db
    .prepare(`
      SELECT c.id, c.status, c.created_at, c.activation_txid,
        parent.founder_post_id AS pay_post_id
      FROM cooks c LEFT JOIN cooks parent ON parent.id = c.parent_id
      WHERE c.id = ?
    `)
    .get(input.cookId) as
    | {
        id: string;
        status: string;
        created_at: string;
        activation_txid: string | null;
        pay_post_id: number | null;
      }
    | undefined;
  if (!cook) return { ok: false, reason: "unknown_cook" };
  if (cook.status === "live") {
    return cook.activation_txid === null || cook.activation_txid === input.txid
      ? { ok: true }
      : { ok: false, reason: "used" };
  }

  const boost = db
    .prepare(`
      SELECT b.post_id, b.boosted_by, b.is_free, b.booted_at
      FROM payouts py JOIN bootboard b ON b.id = py.boot_event_id
      WHERE py.txid = ? LIMIT 1
    `)
    .get(input.txid) as
    | { post_id: number; boosted_by: string; is_free: number; booted_at: string }
    | undefined;
  if (!boost) return { ok: false, reason: "no_payment" };
  if (cook.pay_post_id === null || boost.post_id !== cook.pay_post_id) {
    return { ok: false, reason: "wrong_post" };
  }
  if (boost.boosted_by !== input.payerAddress) return { ok: false, reason: "wrong_payer" };
  if (boost.is_free !== 0) return { ok: false, reason: "not_paid" };
  if (boost.booted_at < cook.created_at) return { ok: false, reason: "too_old" };

  try {
    const changed = db
      .prepare(
        "UPDATE cooks SET status = 'live', activation_txid = ? WHERE id = ? AND status = 'pending'"
      )
      .run(input.txid, cook.id).changes;
    return changed === 1 ? { ok: true } : { ok: false, reason: "used" };
  } catch {
    // Unique index: this payment already took another fork live.
    return { ok: false, reason: "used" };
  }
}
