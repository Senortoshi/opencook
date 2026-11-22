"use client";

import { useEffect, useRef, useState } from "react";
import { activateFork, createPost, getCookStatus } from "@/app/actions";
import { useIdentityContext } from "@/contexts/IdentityContext";
import { satsToDollars, useBsvPrice } from "@/hooks/useBsvPrice";
import { useCurrencyMode } from "@/hooks/useCurrencyMode";
import { checkCookName, cookTagFor, forkPostText } from "@/lib/cooks";
import {
  addPendingFork,
  PENDING_FORKS_EVENT,
  type PendingFork,
  removePendingFork,
} from "@/lib/pending-forks";
import { MAX_POST_LENGTH, normalizePostContent } from "@/lib/post-content";

type Step =
  | { name: "form" }
  | { name: "working"; label: string }
  | { name: "live"; cookId: string; cookName: string }
  | { name: "needs_funds"; fork: PendingFork }
  | { name: "stuck"; fork: PendingFork; paid: boolean; message: string };

interface ForkModalProps {
  /** The cook being forked. Not needed when finishing a waiting fork. */
  parent?: { id: string; name: string; founderPostId: number | null };
  /** A fork this device already made that is still waiting for its payment. */
  resume?: PendingFork;
  /** The current boost price in sats — the fork fee for now. */
  feeSats: number;
  onClose: () => void;
  /** The fork is live: open it. */
  onLive: (cookId: string) => void;
  /** Not enough balance: open the deposit screen. */
  onFundNeeded: (address: string, balance?: number, fee?: number) => void;
}

function notifyPending(): void {
  try {
    window.dispatchEvent(new Event(PENDING_FORKS_EVENT));
  } catch {
    // no window
  }
}

/**
 * Fork a cook. Two things happen, in this order:
 *   1. a signed post "OC<new> fork of OC<parent>" — the permanent, public claim
 *      that names the parent (the credit trail);
 *   2. the fee — a paid boost of the parent's founding post, so the original
 *      author and the contributors are the ones paid.
 * The fork is NOT live until (2) goes through. If it doesn't, the fork waits in
 * the side menu and can be finished later without paying twice.
 *
 * Shell mirrors `SignInModal`. Starts with `requireIdentity()` (Hard Rule 7).
 */
export function ForkModal({
  parent,
  resume,
  feeSats,
  onClose,
  onLive,
  onFundNeeded,
}: ForkModalProps) {
  const { identity, requireIdentity, sign } = useIdentityContext();
  const bsvPrice = useBsvPrice();
  const { isGoat } = useCurrencyMode();
  const [name, setName] = useState("");
  const [pitch, setPitch] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<Step>(
    resume ? { name: "stuck", fork: resume, paid: !!resume.payment, message: "" } : { name: "form" }
  );
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const busy = step.name === "working";
  const money = (sats: number) =>
    isGoat ? `${sats.toLocaleString()} sats` : satsToDollars(sats, bsvPrice);
  const parentName = parent?.name ?? resume?.parentName ?? "";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const set = (next: Step) => {
    if (aliveRef.current) setStep(next);
  };

  /** Pay (or finish paying) for a fork that already has its post. */
  async function pay(fork: PendingFork): Promise<void> {
    if (!requireIdentity() || !identity) return;
    set({ name: "working", label: fork.payment ? "Finishing…" : "Paying…" });
    const status = await getCookStatus(fork.id).catch(() => null);
    if (status?.status === "live") {
      removePendingFork(window.localStorage, fork.id);
      notifyPending();
      set({ name: "live", cookId: fork.id, cookName: fork.name });
      return;
    }
    if (!status || status.payPostId === null) {
      set({
        name: "stuck",
        fork,
        paid: !!fork.payment,
        message: "This fork can't be paid for yet.",
      });
      return;
    }
    const { payForFork } = await import("@/services/bsv/fork-pay");
    const result = await payForFork(identity, fork, status.payPostId, window.localStorage, {
      activateFork,
      onStatus: (s) => set({ name: "working", label: s === "paying" ? "Paying…" : "Finishing…" }),
    });
    notifyPending();
    if (result.status === "live") {
      set({ name: "live", cookId: fork.id, cookName: fork.name });
    } else if (result.status === "needs_funds") {
      onFundNeeded(identity.address, result.balance, result.fee);
      set({ name: "needs_funds", fork });
    } else if (result.status === "paid_not_live") {
      set({
        name: "stuck",
        fork,
        paid: true,
        message: "Your payment went out, but the last step didn't finish.",
      });
    } else {
      set({ name: "stuck", fork, paid: false, message: "The payment didn't go through." });
    }
  }

  async function handleFork(): Promise<void> {
    if (busy || !parent) return;
    if (!requireIdentity() || !identity) return;
    setError("");
    const checked = checkCookName(name);
    if (!checked.ok) {
      setError(checked.reason);
      return;
    }
    if (parent.founderPostId === null) {
      setError("This cook has no posts yet, so there is nobody to pay.");
      return;
    }
    const content = normalizePostContent(forkPostText(name.trim(), parent.name, pitch));
    if (content.length > MAX_POST_LENGTH) {
      setError("That description is too long");
      return;
    }
    set({ name: "working", label: "Posting your fork…" });
    try {
      if (await getCookStatus(checked.id)) {
        set({ name: "form" });
        setError("That name is taken. Pick another.");
        return;
      }
      const signed = await sign(content);
      if (!signed) throw new Error("sign");
      const fd = new FormData();
      fd.set("content", content);
      fd.set("author", identity.name);
      fd.set("signature", signed.signature);
      fd.set("pubkey", signed.pubkey);
      const posted = await createPost(fd);
      if (!posted.ok) {
        set({ name: "form" });
        setError(
          posted.reason === "rate_limited"
            ? "Too fast. Try again in a minute."
            : "Couldn't post the fork. Try again."
        );
        return;
      }
      const fork: PendingFork = { id: checked.id, name: name.trim(), parentName: parent.name };
      addPendingFork(window.localStorage, fork);
      notifyPending();
      await pay(fork);
    } catch {
      set({ name: "form" });
      setError("Something went wrong. Try again.");
    }
  }

  const waiting = step.name === "needs_funds" || step.name === "stuck" ? step.fork : null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[80] w-full bg-black/75 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out] cursor-default"
        aria-label="Close"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div className="fixed inset-0 z-[80] flex items-start justify-center px-6 pt-[6svh] pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fork a cook"
          className="w-full max-w-sm rounded-2xl border border-amber-400/20 shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden pointer-events-auto max-h-[84svh] overflow-y-auto animate-[slideUp_0.3s_ease-out_backwards]"
          style={{ backgroundColor: "#0f0f0f" }}
        >
          <div className="h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
          <div className="flex items-center justify-between px-4 py-3 border-b border-amber-400/10">
            <p className="text-sm font-semibold text-zinc-100 truncate">
              {waiting ? `Finish ${waiting.name}` : `Fork ${parentName}`}
            </p>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="text-zinc-500 hover:text-zinc-200 transition-colors ml-3 disabled:opacity-40"
              aria-label="Close"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="px-4 py-4 space-y-3 text-sm text-zinc-300">
            {step.name === "form" && parent && (
              <>
                <label className="block space-y-1.5">
                  <span className="text-xs text-zinc-500">Name your fork</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={40}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="frogrun"
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2.5 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs text-zinc-500">What will it do differently?</span>
                  <textarea
                    value={pitch}
                    onChange={(e) => setPitch(e.target.value)}
                    rows={3}
                    maxLength={200}
                    className="w-full resize-none rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2.5 text-base text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                  />
                </label>
                {name.trim() && (
                  <p className="text-xs text-zinc-500 break-all">
                    Your first post will read:{" "}
                    <span className="text-zinc-300">
                      {cookTagFor(name.trim())} fork of {cookTagFor(parent.name)}
                    </span>
                  </p>
                )}
                <div className="rounded-xl border border-zinc-800 bg-black/40 px-3 py-2.5 space-y-1.5">
                  <div className="flex justify-between font-semibold text-white tabular-nums">
                    <span>Fork fee</span>
                    <span>{money(feeSats)}</span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-snug">
                    Paid straight to the people who built {parent.name}: its original author and the
                    contributors. Your fork goes live when the payment goes through, not before.
                  </p>
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-300 hover:bg-zinc-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleFork}
                    disabled={!name.trim()}
                    className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:hover:bg-amber-500"
                  >
                    Pay and fork
                  </button>
                </div>
              </>
            )}

            {step.name === "working" && <p className="text-zinc-400">{step.label}</p>}

            {step.name === "live" && (
              <>
                <p className="text-white font-semibold">{step.cookName} is live.</p>
                <p className="text-xs text-zinc-500">
                  It is in the menu now. Post into it by starting a post with{" "}
                  {cookTagFor(step.cookName)}.
                </p>
                <button
                  type="button"
                  onClick={() => onLive(step.cookId)}
                  className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 transition-colors"
                >
                  Open it
                </button>
              </>
            )}

            {waiting && (
              <>
                <p className="text-white font-semibold">
                  {waiting.name} is waiting for its payment.
                </p>
                <p className="text-zinc-400">
                  {step.name === "needs_funds"
                    ? `You need ${money(feeSats)} plus a small network fee. Add funds, then finish here.`
                    : (step.name === "stuck" ? step.message : "") ||
                      "Its first post is saved. It goes live once the fork fee is paid."}
                </p>
                {step.name === "stuck" && step.paid && (
                  <p className="text-xs text-zinc-500">Trying again will not charge you again.</p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-300 hover:bg-zinc-900 transition-colors"
                  >
                    Later
                  </button>
                  <button
                    type="button"
                    onClick={() => pay(waiting)}
                    className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 transition-colors"
                  >
                    {step.name === "stuck" && step.paid ? "Finish" : `Pay ${money(feeSats)}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
