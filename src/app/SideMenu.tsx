"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeSearchQuery, searchSnippet } from "@/lib/post-search";
import { timeAgo } from "@/lib/utils";
import type { Post } from "@/types";
import { searchPosts } from "./actions";
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
  /** Open the feed at a post found by search. */
  onOpenPost: (post: Post) => void;
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
  onOpenPost,
}: SideMenuProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // ── Search: every post, newest first. Read-only, like the rest of the menu. ──
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<Post[] | null>(null);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [searchNote, setSearchNote] = useState("");
  const query = normalizeSearchQuery(searchText);
  // Each keystroke starts a new lookup; only the newest one may write state.
  const searchSeq = useRef(0);
  useEffect(() => {
    const seq = ++searchSeq.current;
    if (!query) {
      setResults(null);
      setSearchNote("");
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const found = await searchPosts(query);
        if (seq !== searchSeq.current) return;
        setResults(found.posts);
        setHasMoreResults(found.more);
        setSearchNote(found.limited ? "Searching too fast. Try again in a moment." : "");
      } catch {
        if (seq !== searchSeq.current) return;
        setResults([]);
        setSearchNote("Search isn't available right now.");
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  // A closed menu forgets its search, so it always reopens on the list of places.
  useEffect(() => {
    if (!open) setSearchText("");
  }, [open]);
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

        <div className="shrink-0 px-2 pb-1">
          <label className="flex h-10 items-center gap-2 rounded-full bg-zinc-900 px-3.5 text-zinc-500">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span className="sr-only">Search posts</span>
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search"
              autoComplete="off"
              enterKeyHint="search"
              className="min-w-0 flex-1 bg-transparent text-base text-white placeholder:text-zinc-500 focus:outline-none"
            />
          </label>
        </div>

        {query ? (
          <div
            className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-1 scrollbar-hide"
            aria-live="polite"
          >
            {searchNote && <p className="px-2.5 py-3 text-[13.5px] text-zinc-500">{searchNote}</p>}
            {!searchNote && results === null && (
              <p className="px-2.5 py-3 text-[13.5px] text-zinc-500">Searching…</p>
            )}
            {!searchNote && results !== null && results.length === 0 && (
              <p className="px-2.5 py-3 text-[13.5px] text-zinc-500">
                No posts mention &ldquo;{query}&rdquo;.
              </p>
            )}
            {results?.map((post) => {
              const snippet = searchSnippet(post.content, query);
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => go(() => onOpenPost(post))}
                  className="block w-full rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-zinc-900 active:bg-zinc-800"
                >
                  <span className="block text-[12.5px] text-zinc-500">
                    {post.author_name} · {timeAgo(post.created_at)}
                  </span>
                  <span className="mt-0.5 block text-[14.5px] leading-snug text-zinc-300 [overflow-wrap:anywhere]">
                    {snippet.before}
                    <span className="font-semibold text-amber-400">{snippet.match}</span>
                    {snippet.after}
                  </span>
                </button>
              );
            })}
            {hasMoreResults && (
              <p className="px-2.5 py-3 text-[12.5px] text-zinc-500">
                Showing the newest {results?.length}. Add a word to narrow it down.
              </p>
            )}
          </div>
        ) : (
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
        )}
      </aside>
    </>
  );
}
