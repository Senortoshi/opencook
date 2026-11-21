/**
 * Integration tests for post search (`searchPosts`). In-memory SQLite via
 * test-support/integration-setup.ts; nothing leaves the test process.
 */

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

let ip = "10.1.0.1";
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Map([["x-forwarded-for", ip]])),
}));

import { db } from "@/lib/db";
import { SEARCH_LIMIT } from "@/lib/post-search";
import { getForwardPosts, searchPosts } from "./actions";

function add(content: string): number {
  return db.prepare("INSERT INTO posts (content, author_name) VALUES (?, 'anon_test')").run(content)
    .lastInsertRowid as number;
}

let ipCounter = 0;

describe("searchPosts — integration", () => {
  beforeEach(() => {
    db.exec("DELETE FROM bootboard");
    db.exec("DELETE FROM posts");
    ip = `10.1.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
  });

  it("finds posts that contain the text, any case, newest first", async () => {
    const a = add("Turn an NFT into a Steel Card");
    add("nothing to see");
    const c = add("steel card v2 is out\nwith a second line");

    const found = await searchPosts("  STEEL   card ");
    expect(found.posts.map((p) => p.id)).toEqual([c, a]);
    expect(found.more).toBe(false);
    expect(found.posts[0]).toMatchObject({ author_name: "anon_test", boot_count: 0 });
  });

  it("returns nothing for input too short to search", async () => {
    add("a b c");
    expect(await searchPosts("a")).toEqual({ posts: [], more: false });
    expect(await searchPosts("   ")).toEqual({ posts: [], more: false });
    // @ts-expect-error — a hostile caller can send anything
    expect(await searchPosts(null)).toEqual({ posts: [], more: false });
  });

  it("treats % and _ as plain characters, and is safe against quotes", async () => {
    const pct = add("up 100% this week");
    add("up 1000 this week");
    const under = add("snake_case name");
    add("snakeXcase name");

    expect((await searchPosts("100%")).posts.map((p) => p.id)).toEqual([pct]);
    expect((await searchPosts("snake_case")).posts.map((p) => p.id)).toEqual([under]);
    expect((await searchPosts("%%")).posts).toEqual([]);
    expect((await searchPosts("'; DROP TABLE posts; --")).posts).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) c FROM posts").get()).toEqual({ c: 4 });
  });

  it("caps the results and says when there are more", async () => {
    for (let i = 0; i < SEARCH_LIMIT + 3; i++) add(`common word ${i}`);
    const found = await searchPosts("common");
    expect(found.posts).toHaveLength(SEARCH_LIMIT);
    expect(found.more).toBe(true);
    expect(found.posts[0].content).toBe(`common word ${SEARCH_LIMIT + 2}`); // newest first
  });

  it("is rate-limited per IP and says so, without pretending there are no results", async () => {
    add("find me");
    ip = "10.99.0.1";
    for (let i = 0; i < 60; i++) expect((await searchPosts("find")).posts).toHaveLength(1);
    expect(await searchPosts("find")).toEqual({ posts: [], more: false, limited: true });
    ip = "10.99.0.2";
    expect((await searchPosts("find")).posts).toHaveLength(1);
  });

  it("a result can be opened in place: the feed read forward starts at that post", async () => {
    add("before");
    const hit = add("the one I searched for");
    const after = add("after");
    const page = await getForwardPosts(hit - 1);
    expect(page.map((p) => p.id)).toEqual([hit, after]);
  });
});
