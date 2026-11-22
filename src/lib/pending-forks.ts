/**
 * Forks this device started that are still waiting for their payment.
 *
 * A fork only goes live once its fee is paid (lib/cooks-db.ts `activateCook`).
 * Between "I made the fork post" and "the payment went through" the person may
 * close the tab, run out of balance, or lose connection — so the browser keeps
 * a small list in localStorage and the side menu offers to finish each one.
 *
 * `payment` is filled in THE MOMENT a payment is broadcast, before anything
 * else: a later retry then re-submits that same payment and never pays twice.
 *
 * Pure: storage is passed in. Nothing here is secret (a raw transaction is
 * public once broadcast), and nothing here moves money.
 */

export const PENDING_FORKS_KEY = "opencook_pending_forks";
export const PENDING_FORKS_EVENT = "opencook:pending-forks";

export interface PendingFork {
  id: string;
  name: string;
  parentName: string;
  /** Set once a payment was broadcast for this fork. Never cleared while pending. */
  payment?: { txid: string; rawTx: string; postId: number };
}

type Store = Pick<Storage, "getItem" | "setItem">;

export function loadPendingForks(store: Pick<Storage, "getItem">): PendingFork[] {
  try {
    const parsed = JSON.parse(store.getItem(PENDING_FORKS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is PendingFork =>
        !!f &&
        typeof f.id === "string" &&
        typeof f.name === "string" &&
        typeof f.parentName === "string"
    );
  } catch {
    return [];
  }
}

function save(store: Store, forks: PendingFork[]): boolean {
  try {
    const value = JSON.stringify(forks);
    store.setItem(PENDING_FORKS_KEY, value);
    return store.getItem(PENDING_FORKS_KEY) === value;
  } catch {
    return false;
  }
}

/** Remember a fork that was just created (no-op if already listed). */
export function addPendingFork(store: Store, fork: PendingFork): boolean {
  const forks = loadPendingForks(store);
  if (forks.some((f) => f.id === fork.id)) return true;
  return save(store, [...forks, fork]);
}

/**
 * Record the payment that was broadcast for a fork. Returns false if it could
 * not be stored — the caller still continues (the payment is already out), it
 * just can't be resumed from this device.
 */
export function setPendingForkPayment(
  store: Store,
  id: string,
  payment: NonNullable<PendingFork["payment"]>
): boolean {
  const forks = loadPendingForks(store);
  const index = forks.findIndex((f) => f.id === id);
  if (index < 0) return false;
  // Never replace a recorded payment with a different one.
  if (forks[index].payment && forks[index].payment?.txid !== payment.txid) return false;
  forks[index] = { ...forks[index], payment };
  return save(store, forks);
}

/** Forget a fork once it is live (or was given up on). */
export function removePendingFork(store: Store, id: string): boolean {
  return save(
    store,
    loadPendingForks(store).filter((f) => f.id !== id)
  );
}
