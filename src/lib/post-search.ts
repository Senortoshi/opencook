/**
 * Post search — pure helpers shared by the server action and the menu.
 *
 * Search is a plain, case-insensitive "contains" over post text. No index, no
 * ranking: at this size a scan is instant, and newest-first is the order people
 * expect from a feed. Read-only; it touches no identity or money.
 */

/** Shortest query that searches (one character matches almost everything). */
export const SEARCH_MIN_LENGTH = 2;
/** Longest query accepted. */
export const SEARCH_MAX_LENGTH = 80;
/** Most results returned for one query. */
export const SEARCH_LIMIT = 40;

/**
 * Tidy what the person typed: trim, collapse runs of whitespace. Returns null
 * when it is too short to search. Over-long input is cut, not refused.
 */
export function normalizeSearchQuery(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const query = raw.replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX_LENGTH).trim();
  return query.length >= SEARCH_MIN_LENGTH ? query : null;
}

/**
 * A SQL LIKE pattern that matches `query` literally anywhere in the text.
 * `%`, `_` and the escape character itself are escaped, so a search for "100%"
 * finds "100%" and not everything. Use with `ESCAPE '\'`.
 */
export function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export interface Snippet {
  /** Text before the match (may start with an ellipsis). */
  before: string;
  /** The matched text, as it appears in the post. */
  match: string;
  /** Text after the match (may end with an ellipsis). */
  after: string;
}

/**
 * A one-line excerpt of `content` around the first place `query` appears, so a
 * result shows WHY it matched. Line breaks become spaces. If the query is not
 * found (it shouldn't happen for a real result) the start of the post is shown.
 */
export function searchSnippet(content: string, query: string, radius = 48): Snippet {
  const flat = content.replace(/\s+/g, " ").trim();
  const at = flat.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) {
    const head = flat.slice(0, radius * 2);
    return { before: head + (flat.length > head.length ? "…" : ""), match: "", after: "" };
  }
  const start = Math.max(0, at - radius);
  const end = Math.min(flat.length, at + query.length + radius);
  return {
    before: (start > 0 ? "…" : "") + flat.slice(start, at),
    match: flat.slice(at, at + query.length),
    after: flat.slice(at + query.length, end) + (end < flat.length ? "…" : ""),
  };
}
