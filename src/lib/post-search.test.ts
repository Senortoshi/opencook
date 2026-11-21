import { describe, expect, it } from "vitest";
import { likePattern, normalizeSearchQuery, SEARCH_MAX_LENGTH, searchSnippet } from "./post-search";

describe("normalizeSearchQuery", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeSearchQuery("  steel   card \n")).toBe("steel card");
  });

  it("refuses input too short to search, and non-strings", () => {
    expect(normalizeSearchQuery("")).toBeNull();
    expect(normalizeSearchQuery(" a ")).toBeNull();
    expect(normalizeSearchQuery(undefined)).toBeNull();
    expect(normalizeSearchQuery(42)).toBeNull();
  });

  it("cuts over-long input instead of refusing it", () => {
    expect(normalizeSearchQuery("x".repeat(500))).toHaveLength(SEARCH_MAX_LENGTH);
  });
});

describe("likePattern", () => {
  it("wraps the query and escapes the LIKE wildcards", () => {
    expect(likePattern("froge")).toBe("%froge%");
    expect(likePattern("100%")).toBe("%100\\%%");
    expect(likePattern("a_b")).toBe("%a\\_b%");
    expect(likePattern("c:\\x")).toBe("%c:\\\\x%");
  });
});

describe("searchSnippet", () => {
  it("shows the match with text on both sides, as written in the post", () => {
    expect(searchSnippet("Turn an NFT into a Steel Card today", "steel card", 8)).toEqual({
      before: "… into a ",
      match: "Steel Card",
      after: " today",
    });
  });

  it("flattens line breaks and marks cut text with an ellipsis", () => {
    const snippet = searchSnippet("line one\nline two has the word\nline three goes on", "word", 6);
    expect(snippet).toEqual({ before: "…s the ", match: "word", after: " line …" });
  });

  it("has no leading ellipsis when the match is at the start", () => {
    expect(searchSnippet("froge is here", "froge", 4)).toEqual({
      before: "",
      match: "froge",
      after: " is …",
    });
  });

  it("falls back to the start of the post when the query is not in it", () => {
    expect(searchSnippet("abcdefghij", "zzz", 2)).toEqual({
      before: "abcd…",
      match: "",
      after: "",
    });
  });
});
