import { describe, expect, it } from "vitest";
import {
  addPendingFork,
  loadPendingForks,
  PENDING_FORKS_KEY,
  removePendingFork,
  setPendingForkPayment,
} from "./pending-forks";

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
}

const fork = { id: "frogrun", name: "FrogRun", parentName: "Froge" };
const payment = { txid: "a".repeat(64), rawTx: "0100", postId: 7 };

describe("pending-forks", () => {
  it("starts empty and survives junk in storage", () => {
    expect(loadPendingForks(memoryStore())).toEqual([]);
    expect(loadPendingForks(memoryStore({ [PENDING_FORKS_KEY]: "{not json" }))).toEqual([]);
    expect(loadPendingForks(memoryStore({ [PENDING_FORKS_KEY]: '{"a":1}' }))).toEqual([]);
    expect(loadPendingForks(memoryStore({ [PENDING_FORKS_KEY]: '[{"id":1},null,"x"]' }))).toEqual(
      []
    );
  });

  it("adds a fork once, records its payment, and removes it when live", () => {
    const store = memoryStore();
    expect(addPendingFork(store, fork)).toBe(true);
    expect(addPendingFork(store, fork)).toBe(true);
    expect(loadPendingForks(store)).toEqual([fork]);

    expect(setPendingForkPayment(store, "frogrun", payment)).toBe(true);
    expect(loadPendingForks(store)).toEqual([{ ...fork, payment }]);

    expect(removePendingFork(store, "frogrun")).toBe(true);
    expect(loadPendingForks(store)).toEqual([]);
  });

  it("never replaces a recorded payment with a different one", () => {
    // The guard behind "trying again will not charge you again".
    const store = memoryStore();
    addPendingFork(store, fork);
    setPendingForkPayment(store, "frogrun", payment);
    expect(setPendingForkPayment(store, "frogrun", { ...payment, txid: "b".repeat(64) })).toBe(
      false
    );
    expect(loadPendingForks(store)[0].payment?.txid).toBe(payment.txid);
    // Recording the same payment again is fine.
    expect(setPendingForkPayment(store, "frogrun", payment)).toBe(true);
  });

  it("reports failure for an unknown fork or storage that keeps nothing", () => {
    const store = memoryStore();
    expect(setPendingForkPayment(store, "nope", payment)).toBe(false);
    const blackHole = { getItem: () => null, setItem: () => {} };
    expect(addPendingFork(blackHole, fork)).toBe(false);
  });
});
