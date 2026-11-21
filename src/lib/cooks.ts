/**
 * Cooks — an idea people pile onto gets its own feed. Pure helpers (no DB).
 *
 * HOW A POST LANDS IN A COOK: by a tag at the very start of its text —
 * `OCfroge add a hat`. Nothing new goes on-chain: the tag is part of the post
 * text, which is already signed by its author and logged, so a cook's feed and
 * its family tree can be rebuilt from the chain alone (DECISIONS "On-chain
 * reconstructability"; build-journal 2026-11-17 "The big finding").
 *
 * HOW A FORK IS MADE: a post whose first line reads
 * `OC<new name> fork of OC<parent>`. The fork's own signed first post names its
 * parent, so the credit trail cannot be dropped.
 *
 * A cook's id is its normalized tag: lowercase letters and digits only. So
 * `OCtherealbitcoin.fun`, `OCTheRealBitcoinFun` and `OCtherealbitcoin.fun.` all
 * mean the same cook.
 */

export const COOK_ID_MIN = 3;
export const COOK_ID_MAX = 32;
/** Longest display name accepted for a new cook. */
export const COOK_NAME_MAX = 40;

/** Ids that can never be a cook (the main feed's own name, and near-misses). */
const RESERVED = new Set(["opencook", "main", "feed", "welcome", "genesis", "all", "fork"]);

/** Normalize a name or tag to a cook id. Returns null when it can't be one. */
export function cookIdFrom(nameOrTag: string): string | null {
  const id = nameOrTag
    .replace(/^OC/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (id.length < COOK_ID_MIN || id.length > COOK_ID_MAX) return null;
  if (RESERVED.has(id)) return null;
  return id;
}

/** The tag people type to post into a cook, e.g. `OCtherealbitcoin.fun`. */
export function cookTagFor(name: string): string {
  return `OC${name.replace(/\s+/g, "")}`;
}

// `OC` (capitals) glued to a name: letters/digits, with . _ - allowed inside.
const TAG_RE = /^OC([A-Za-z0-9][A-Za-z0-9._-]{1,47})(?=[\s,:;!?]|$)/;
const FORK_RE =
  /^OC([A-Za-z0-9][A-Za-z0-9._-]{1,47})[ \t]+fork of[ \t]+OC([A-Za-z0-9][A-Za-z0-9._-]{1,47})(?=[\s,:;!?]|$)/i;

export interface ParsedCookPost {
  /** Cook the post is filed under. */
  cookId: string;
  /** The name as typed (without `OC`, trailing dots trimmed) — used when a fork is created. */
  name: string;
  /** Present when the post asks to fork: the parent's cook id. */
  forkOf?: string;
  /** For a fork: the rest of the post after the first line (its pitch). */
  pitch?: string;
}

function tidyName(raw: string): string {
  return raw.replace(/[._-]+$/, "");
}

/**
 * Read a post's cook tag. Null when the post does not start with one.
 * `content` is the canonical post string (already LF-normalized and trimmed).
 */
export function parseCookPost(content: string): ParsedCookPost | null {
  const fork = FORK_RE.exec(content);
  if (fork) {
    const cookId = cookIdFrom(fork[1]);
    const forkOf = cookIdFrom(fork[2]);
    if (cookId && forkOf && cookId !== forkOf) {
      const rest = content.slice(fork[0].length).replace(/^[\s,:;!?.-]+/, "");
      return { cookId, name: tidyName(fork[1]), forkOf, pitch: rest.slice(0, 200) };
    }
  }
  const tag = TAG_RE.exec(content);
  if (!tag) return null;
  const cookId = cookIdFrom(tag[1]);
  return cookId ? { cookId, name: tidyName(tag[1]) } : null;
}

/** A name someone typed for a new fork: is it usable, and what id does it give? */
export function checkCookName(
  name: string
): { ok: true; id: string } | { ok: false; reason: string } {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { ok: false, reason: "Give it a name" };
  if (trimmed.length > COOK_NAME_MAX) return { ok: false, reason: "That name is too long" };
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(trimmed)) {
    return { ok: false, reason: "Use letters, numbers, dots or dashes, no spaces" };
  }
  const id = cookIdFrom(trimmed);
  if (!id) return { ok: false, reason: "Pick a name with 3 to 32 letters or numbers" };
  return { ok: true, id };
}

/** The exact first line of a fork post. Single source for the client and tests. */
export function forkPostText(newName: string, parentName: string, pitch: string): string {
  const head = `${cookTagFor(newName)} fork of ${cookTagFor(parentName)}`;
  const body = pitch.trim();
  return body ? `${head}\n${body}` : head;
}

/**
 * The string the PAYER signs to say "this payment is for this fork".
 * A fork does not go live until a payment is executed (owner direction,
 * 2026-11-21): the payment is a paid boost of the parent cook's founding post,
 * so the original author and the contributors are the ones paid. This message
 * binds that payment's txid to one cook, so nobody can point at somebody else's
 * boost and call it theirs. Single source for client and server.
 */
export function spawnMessage(cookId: string, txid: string): string {
  return `spawn:${cookId}:${txid.trim().toLowerCase()}`;
}
