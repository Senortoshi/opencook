/**
 * Pay for a fork so it can go live — browser side.
 *
 * The fee is an ordinary PAID boost of the parent cook's founding post, so it
 * goes out through the SAME audited pieces a boost uses and this file adds no
 * new way of moving money:
 *   /api/boot-shares  → who gets what (original author, contributors, platform)
 *   clientSideBoot    → builds, signs, broadcasts (lib unchanged)
 *   /api/boot-confirm → server verifies the transaction and records it
 * then one extra, money-free step: `activateFork` ties that payment to the fork.
 *
 * THE RULE INHERITED FROM useBoot (Finding 6): once a payment is broadcast,
 * NEVER build another one for the same fork. The txid + raw transaction are
 * written to the pending-fork list the moment they exist, and every retry
 * re-submits that same payment.
 *
 * Callers MUST be past `requireIdentity()` (CLAUDE.md Hard Rule 7).
 */

import { bootConfirmMessage } from "@/lib/boot-message";
import { spawnMessage } from "@/lib/cooks";
import {
  loadPendingForks,
  type PendingFork,
  removePendingFork,
  setPendingForkPayment,
} from "@/lib/pending-forks";

export type ForkPayResult =
  | { status: "live" }
  | { status: "needs_funds"; balance?: number; fee?: number; price: number }
  /** Paid, but the last step did not finish. Trying again will NOT pay again. */
  | { status: "paid_not_live"; reason: string }
  | { status: "failed"; reason: string };

export interface ForkPayDeps {
  activateFork: (
    cookId: string,
    txid: string,
    payerPubkey: string,
    signature: string
  ) => Promise<{ ok: boolean; reason?: string }>;
  onStatus?: (status: "paying" | "confirming") => void;
}

type Store = Pick<Storage, "getItem" | "setItem">;

async function signWith(wif: string, message: string): Promise<{ sig: string; pubkey: string }> {
  const { PrivateKey } = await import("@bsv/sdk");
  const key = PrivateKey.fromWif(wif);
  return {
    sig: key.sign(Array.from(new TextEncoder().encode(message))).toDER("hex") as string,
    pubkey: key.toPublicKey().toString(),
  };
}

/** Confirm an already-broadcast payment with the server, then take the fork live. */
async function finish(
  identity: { wif: string; name: string },
  fork: PendingFork,
  payment: NonNullable<PendingFork["payment"]>,
  store: Store,
  deps: ForkPayDeps
): Promise<ForkPayResult> {
  deps.onStatus?.("confirming");
  try {
    const boot = await signWith(identity.wif, bootConfirmMessage(payment.postId, payment.txid));
    const body = JSON.stringify({
      postId: payment.postId,
      txid: payment.txid,
      rawTx: payment.rawTx,
      booterPubkey: boot.pubkey,
      signature: boot.sig,
      booterName: identity.name,
    });
    const post = () =>
      fetch("/api/boot-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    let res = await post();
    for (let attempt = 0; attempt < 2 && res.status === 503; attempt++) {
      await new Promise((r) => setTimeout(r, 1500));
      res = await post();
    }
    // 409 = this payment is already recorded (fine) — unless it is a conflict.
    if (!res.ok && res.status !== 409) {
      return { status: "paid_not_live", reason: `confirm ${res.status}` };
    }
    if (res.status === 409) {
      const data = await res.json().catch(() => ({}));
      if (data?.code === "TX_CONFLICT") return { status: "paid_not_live", reason: "conflict" };
    }

    const spawn = await signWith(identity.wif, spawnMessage(fork.id, payment.txid));
    const activated = await deps.activateFork(fork.id, payment.txid, spawn.pubkey, spawn.sig);
    if (!activated.ok) {
      return { status: "paid_not_live", reason: activated.reason ?? "not activated" };
    }
    removePendingFork(store, fork.id);
    return { status: "live" };
  } catch (e) {
    return { status: "paid_not_live", reason: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Pay for `fork` (or finish a payment already made) and take it live.
 * `payPostId` is the parent cook's founding post.
 */
export async function payForFork(
  identity: { wif: string; address: string; name: string },
  fork: PendingFork,
  payPostId: number,
  store: Store,
  deps: ForkPayDeps
): Promise<ForkPayResult> {
  // A payment already went out for this fork → never build another.
  const known = loadPendingForks(store).find((f) => f.id === fork.id)?.payment ?? fork.payment;
  if (known) return finish(identity, fork, known, store, deps);

  try {
    deps.onStatus?.("paying");
    const sharesRes = await fetch(
      `/api/boot-shares?postId=${payPostId}&pubkey=${encodeURIComponent(identity.address)}`
    );
    if (!sharesRes.ok) return { status: "failed", reason: `shares ${sharesRes.status}` };
    const shares = await sharesRes.json();

    const { clientSideBoot, consolidateUtxos } = await import("./client-boot");
    const build = () =>
      clientSideBoot(
        identity.wif,
        identity.address,
        payPostId,
        shares.shares,
        shares.bootPrice,
        undefined,
        shares.postCid
      );
    let result = await build();
    if (result.status === "needs_consolidation") {
      const tidy = await consolidateUtxos(identity.wif, identity.address);
      if (tidy.status !== "success") return { status: "failed", reason: "could not prepare" };
      result = await build();
    }
    if (result.status === "insufficient_funds") {
      return {
        status: "needs_funds",
        balance: result.balance,
        fee: result.estimatedFee,
        price: shares.bootPrice,
      };
    }
    if (result.status !== "success" || !result.txid || !result.rawTx) {
      return { status: "failed", reason: result.error ?? result.status };
    }

    // The money is out. Write it down BEFORE anything else can fail.
    const payment = { txid: result.txid, rawTx: result.rawTx, postId: payPostId };
    setPendingForkPayment(store, fork.id, payment);
    return finish(identity, fork, payment, store, deps);
  } catch (e) {
    return { status: "failed", reason: e instanceof Error ? e.message : String(e) };
  }
}
