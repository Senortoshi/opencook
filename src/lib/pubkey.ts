/**
 * Public-key input check shared by server actions.
 */

const PUBKEY_RE = /^0[23][0-9a-f]{64}$/;

/** Canonical compressed-hex public key (lowercase, trimmed), or null if it is not one. */
export function normalizePubkey(pubkey: unknown): string | null {
  if (typeof pubkey !== "string") return null;
  const value = pubkey.trim().toLowerCase();
  return PUBKEY_RE.test(value) ? value : null;
}
