"use client";

import { useEffect, useRef } from "react";
import type { FeedMode } from "./Feed";

interface SideMenuProps {
  open: boolean;
  onClose: () => void;
  /** Feed mode, so the row for the view you are in reads as selected. */
  mode: FeedMode;
  /** New posts in the main feed that arrived below the reading position. */
  unreadCount: number;
  onGoLive: () => void;
  onGoOrigin: () => void;
}

/**
 * Slide-in side menu (phone shell, step 2 of the Cooks plan).
 *
 * Holds the places you can go. Today that is the main feed and the beginning of
 * the feed; cooks get their own rows here later. Read-only navigation — it
 * never touches identity or money, so it never asks for sign-in.
 *
 * Always mounted so it can slide; `inert` while closed keeps it out of the tab
 * order and away from screen readers.
 */
export function SideMenu({
  open,
  onClose,
  mode,
  unreadCount,
  onGoLive,
  onGoOrigin,
}: SideMenuProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Escape closes; focus moves into the menu on open and back to the opener on close.
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      returnFocusRef.current?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  function go(action: () => void) {
    onClose();
    action();
  }

  const row =
    "flex min-h-11 w-full items-center gap-3 rounded-[10px] px-2.5 text-left transition-colors hover:bg-zinc-900 active:bg-zinc-800";

  return (
    <>
      {/* Scrim — tap outside to close. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/55 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id="side-menu"
        aria-label="Menu"
        inert={!open}
        className={`fixed inset-y-0 left-0 z-[45] flex w-[min(84vw,320px)] flex-col border-r border-zinc-900 bg-[#0c0c0c] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] transition-transform duration-300 ease-[cubic-bezier(0.2,0.9,0.25,1)] motion-reduce:transition-none ${
          open ? "translate-x-0" : "-translate-x-[102%]"
        }`}
      >
        <div className="flex h-12 shrink-0 items-center justify-between pl-[18px] pr-1.5">
          <span className="text-[17px] font-semibold tracking-tight">
            <span className="text-amber-400">Open</span>Cook
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid h-10 w-10 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-zinc-900"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-1 scrollbar-hide">
          <button
            type="button"
            onClick={() => go(onGoLive)}
            aria-current={mode === "live" ? "page" : undefined}
            className={`${row} ${mode === "live" ? "bg-zinc-900" : ""}`}
          >
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate text-[15.5px] ${unreadCount > 0 ? "font-semibold" : ""}`}
              >
                Main feed
              </span>
              <span className="block truncate text-[12.5px] text-zinc-500">
                Every post, newest at the bottom
              </span>
            </span>
            {unreadCount > 0 && (
              <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-amber-500 px-1.5 text-xs font-semibold tabular-nums leading-none text-black">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => go(onGoOrigin)}
            aria-current={mode === "origin" ? "page" : undefined}
            className={`${row} mt-0.5 ${mode === "origin" ? "bg-zinc-900" : ""}`}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15.5px]">The beginning</span>
              <span className="block truncate text-[12.5px] text-zinc-500">
                The vision and post #1, read forward
              </span>
            </span>
          </button>
        </nav>
      </aside>
    </>
  );
}
