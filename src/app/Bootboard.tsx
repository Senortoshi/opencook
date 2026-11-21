"use client";

import { useEffect, useRef, useState } from "react";
import { BootIcon } from "@/components/icons/BootIcon";
import { useBootContext } from "@/contexts/BootContext";
import { useIdentityContext } from "@/contexts/IdentityContext";
import { useBoot } from "@/hooks/useBoot";
import type { BootboardData } from "@/types";

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function LiveTimer({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(`${since}Z`).getTime();
    function tick() {
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [since]);

  return <span className="font-mono text-amber-400 text-xs">{formatDuration(elapsed)}</span>;
}

function HistoryRow({
  entry,
  onBooted,
  onFundNeeded,
}: {
  entry: BootboardData["history"][0];
  onBooted?: () => void;
  onFundNeeded?: (address: string, balance?: number, fee?: number) => void;
}) {
  const { identity, requireIdentity } = useIdentityContext();
  const { bootingPostId, throttled } = useBootContext();
  const { boot } = useBoot({ onBooted, onFundNeeded });

  const isThisBooting = bootingPostId === entry.post_id;
  const anyBooting = bootingPostId !== null;
  const isBlocked = anyBooting || throttled;

  function handleReboot() {
    if (isBlocked) return;
    // Opens SignInModal if locked; caller retaps after signing in.
    if (!requireIdentity() || !identity) return;
    boot(entry.post_id, identity);
  }

  return (
    <div className="flex items-center gap-2 text-[11px] text-zinc-600 py-0.5">
      <button
        type="button"
        onClick={handleReboot}
        disabled={isBlocked}
        className={`relative -m-2 p-2 shrink-0 flex items-center rounded-full transition-all disabled:cursor-not-allowed border ${
          isThisBooting
            ? "text-amber-400 border-amber-500/40"
            : isBlocked
              ? "opacity-50 text-zinc-600 border-zinc-800"
              : "text-zinc-600 border-zinc-800 hover:border-zinc-700 hover:text-amber-400 hover:bg-zinc-800/50 disabled:opacity-30"
        }`}
        title="Reboot this post"
      >
        {isThisBooting ? (
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="animate-spin text-amber-400"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeOpacity="0.25"
            />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <BootIcon size={11} />
        )}
      </button>
      <span className="text-zinc-500 shrink-0">{entry.author_name}</span>
      <span className="shrink-0">·</span>
      <span className="shrink-0">{formatDuration(entry.duration_seconds)}</span>
      <span className="shrink-0">·</span>
      <span className="truncate">{entry.content}</span>
    </div>
  );
}

export function Bootboard({
  data,
  onBooted,
  bootPrice,
  onFundNeeded,
}: {
  data: BootboardData;
  onBooted?: () => void;
  bootPrice?: number;
  onFundNeeded?: (address: string, balance?: number, fee?: number) => void;
}) {
  const { current, history } = data;
  const [shaking, setShaking] = useState(false);
  const [glowing, setGlowing] = useState(false);
  const [slideIn, setSlideIn] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const prevIdRef = useRef<number | null>(null);

  useEffect(() => {
    const currentId = current?.id ?? null;
    if (prevIdRef.current !== null && currentId !== null && currentId !== prevIdRef.current) {
      setShaking(true);
      setGlowing(true);
      setSlideIn(true);

      const shakeTimer = setTimeout(() => setShaking(false), 600);
      const glowTimer = setTimeout(() => setGlowing(false), 1200);
      const slideTimer = setTimeout(() => setSlideIn(false), 400);

      prevIdRef.current = currentId;
      return () => {
        clearTimeout(shakeTimer);
        clearTimeout(glowTimer);
        clearTimeout(slideTimer);
      };
    }
    prevIdRef.current = currentId;
  }, [current?.id]);

  const panelId = "bootboard-panel";

  // One pinned line (phone shell): boot icon · who · the post, truncated · how
  // long it has held the spot. Tapping the line opens the full board beneath it
  // (the whole post, who booted it, and the history with reboot). The line keeps
  // the header + keyboard from squeezing the feed on a phone.
  return (
    <div
      className={`relative border-b transition-all duration-300 ${
        glowing
          ? "border-amber-400 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
          : "border-zinc-800 bg-transparent"
      } ${shaking ? "animate-[shake_0.5s_ease-in-out]" : ""}`}
    >
      {current ? (
        <div className={slideIn ? "animate-[slideUp_0.4s_ease-out_backwards]" : ""}>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-label={expanded ? "Close the Bootboard" : "Open the Bootboard"}
            className="flex h-9 w-full items-center gap-2 text-left text-sm active:opacity-60"
          >
            <BootIcon size={14} className="text-amber-400 shrink-0" />
            <span className="shrink-0 font-medium text-zinc-500">{current.author_name}</span>
            {current.signature && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0"
                title="Signed"
              />
            )}
            <span className="min-w-0 flex-1 truncate text-zinc-300">
              {expanded ? "" : current.content}
            </span>
            <LiveTimer since={current.booted_at} />
            <svg
              width="14"
              height="8"
              viewBox="0 0 14 8"
              fill="none"
              aria-hidden="true"
              className={`shrink-0 text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              <path
                d="M2 2l5 4 5-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Open: the whole post, who booted it, scrollable history with reboot */}
          {expanded && (
            <div
              id={panelId}
              className="animate-[slideUp_0.2s_ease-out_backwards] max-h-[45dvh] overflow-y-auto scrollbar-hide pb-3"
              style={{ scrollbarWidth: "none" }}
            >
              <p className="text-[15px] leading-snug text-zinc-100 whitespace-pre-wrap break-words">
                {current.content}
              </p>
              <div className="mt-2 pt-2 border-t border-zinc-800/60">
                <div className="flex items-center gap-2 text-[11px] text-zinc-600 mb-1.5">
                  <span>booted by {current.boosted_by_name ?? current.boosted_by}</span>
                </div>
                {history.length > 0 && (
                  <div className="space-y-1 pl-2">
                    {history.map((h) => (
                      <HistoryRow
                        key={`${h.post_id}-${h.booted_at}`}
                        entry={h}
                        onBooted={onBooted}
                        onFundNeeded={onFundNeeded}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-9 items-center gap-2 text-sm">
          <BootIcon size={14} className="text-amber-400 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-zinc-500">
            Boost any post to claim the spotlight
          </span>
          {bootPrice !== undefined && bootPrice > 0 && (
            <span className="shrink-0 text-xs tabular-nums text-zinc-600">
              {bootPrice.toLocaleString()} sats
            </span>
          )}
        </div>
      )}
    </div>
  );
}
