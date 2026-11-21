"use client";

import { IdentityChip } from "./IdentityBar";

interface HeaderProps {
  isAtTop: boolean;
  genesisHydrated: boolean;
  genesisVisited: boolean;
  onScrollToGenesis: () => void;
  onOpenFairness: () => void;
  /** Total unread shown on the menu button. */
  unreadCount: number;
  menuOpen: boolean;
  onOpenMenu: () => void;
}

export function Header({
  isAtTop,
  genesisHydrated,
  genesisVisited,
  onScrollToGenesis,
  unreadCount,
  menuOpen,
  onOpenMenu,
}: HeaderProps) {
  return (
    <header className="shrink-0 border-b border-zinc-800 bg-black">
      {/* 48px bar. Height = safe-area-inset-top + 48px with the inset as top
          padding, so the row isn't covered by the PWA status bar (where
          statusBarStyle is black-translucent — content extends behind the
          status bar). In Safari the env value resolves to 0. */}
      <div className="mx-auto flex h-[calc(env(safe-area-inset-top)+3rem)] max-w-2xl items-center gap-1 pl-1.5 pr-4 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label={unreadCount > 0 ? `Open menu, ${unreadCount} unread` : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="side-menu"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-zinc-100 transition-colors hover:bg-zinc-900 active:opacity-60"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 8.5h16M4 15.5h10" />
          </svg>
          {unreadCount > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-xs font-semibold tabular-nums leading-none text-black">
              {unreadCount}
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onScrollToGenesis}
            className="block max-w-full text-left leading-none"
            title="OpenCook — back to the vision"
          >
            <h1 className="truncate text-[17px] font-semibold tracking-tight leading-tight hover:text-amber-400 transition-colors duration-150">
              <span className="text-amber-400">Open</span>Cook
            </h1>
          </button>
          {/* "Agentic Fairness" kept as branding; the splits panel entry is disabled
              for launch until real Agentic Fairness splits exist. Re-enable: turn this
              span back into a <button type="button" onClick={onOpenFairness}> (the prop
              is still declared in HeaderProps). */}
          <span className="block truncate text-[11px] leading-tight text-zinc-500 tracking-wide">
            Agentic Fairness
          </span>
        </div>

        {/* Genesis shortcut — in the row (not centred) so it can't collide with
            the title on narrow phones now that the menu button sits to its left. */}
        {genesisHydrated &&
          !isAtTop &&
          (genesisVisited ? (
            <button
              type="button"
              onClick={onScrollToGenesis}
              className="grid h-10 w-10 shrink-0 place-items-center text-zinc-700 transition-colors hover:text-amber-400/60"
              title="Back to Genesis"
            >
              <svg width="16" height="8" viewBox="0 0 16 8" fill="none" aria-hidden="true">
                <path
                  d="M1 7l7-5 7 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={onScrollToGenesis}
              className="mr-2 flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-full bg-zinc-800 border border-zinc-700 px-2 py-1.5 sm:px-3 text-[11px] sm:text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                className="text-amber-400"
              >
                <path
                  d="M8 13V3m0 0l-4 4m4-4l4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="hidden sm:inline">Genesis</span>
              <span className="sm:hidden">Origin</span>
            </button>
          ))}

        <IdentityChip />
      </div>
    </header>
  );
}
