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
 * Deliberately NOT here: any payout or split, and any way to START a cook. Paying a cook is a separate,
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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
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
 * File a NEW post under the cook named by the tag at the start of its text.
 * Call inside the same transaction that inserts the post. Returns the cook it
 * was filed under, for tests.
 *
 * A tag for a cook that does not exist files nothing and creates nothing:
 * starting a cook (from nothing, or as a fork) is not open in this version.
 */
export function fileNewPost(db: Db, postId: number, content: string): { cookId: string } | null {
  const parsed = parseCookPost(content);
  if (!parsed) return null;
  if (!db.prepare("SELECT 1 FROM cooks WHERE id = ?").get(parsed.cookId)) return null;
  db.prepare("INSERT OR IGNORE INTO cook_posts (post_id, cook_id) VALUES (?, ?)").run(
    postId,
    parsed.cookId
  );
  return { cookId: parsed.cookId };
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
