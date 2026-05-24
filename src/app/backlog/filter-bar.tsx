"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { GameStatus } from "@prisma/client";

const UNENRICHED_KEY = "unenriched";
const MULTIPLAYER_KEY = "multiplayer";

const STATUS_TABS: { label: string; value: GameStatus | "all" | typeof UNENRICHED_KEY | typeof MULTIPLAYER_KEY }[] = [
  { label: "All", value: "all" },
  { label: "Wishlist", value: "WISHLIST" },
  { label: "Untriaged", value: "UNTRIAGED" },
  { label: "Playing", value: "PLAYING" },
  { label: "Paused", value: "PAUSED" },
  { label: "Unplayed", value: "UNPLAYED" },
  { label: "Beat", value: "BEAT" },
  { label: "Dropped", value: "DROPPED" },
  { label: "Multiplayer", value: MULTIPLAYER_KEY },
  { label: "No metadata", value: UNENRICHED_KEY },
];

const SORT_LABELS: Record<string, string> = {
  recent: "Recently played",
  playtime: "Most played",
  title: "Title (A→Z)",
  added: "Recently added",
};

export function FilterBar({
  activeStatus,
  isUnenriched,
  isMultiplayerView,
  query,
  sort,
  countsByStatus,
  totalCount,
  unenrichedCount,
  multiplayerCount,
}: {
  activeStatus?: GameStatus;
  isUnenriched?: boolean;
  isMultiplayerView?: boolean;
  query: string;
  sort: string;
  countsByStatus: Record<GameStatus, number>;
  totalCount: number;
  unenrichedCount: number;
  multiplayerCount: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => {
      router.push(`/backlog?${next.toString()}`);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const isActive =
            tab.value === "all"
              ? !activeStatus && !isUnenriched && !isMultiplayerView
              : tab.value === UNENRICHED_KEY
              ? !!isUnenriched
              : tab.value === MULTIPLAYER_KEY
              ? !!isMultiplayerView
              : activeStatus === tab.value;
          const count =
            tab.value === "all"
              ? totalCount
              : tab.value === UNENRICHED_KEY
              ? unenrichedCount
              : tab.value === MULTIPLAYER_KEY
              ? multiplayerCount
              : countsByStatus[tab.value as GameStatus];
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() =>
                update({ status: tab.value === "all" ? undefined : tab.value })
              }
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                isActive
                  ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-50 dark:text-zinc-900 dark:border-zinc-50"
                  : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }`}
            >
              {tab.label}
              <span className="ml-1 opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="search"
          defaultValue={query}
          placeholder="Search title…"
          onChange={(e) => update({ q: e.target.value || undefined })}
          className="flex-1 min-w-48 px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50"
        />
        <select
          value={sort}
          onChange={(e) => update({ sort: e.target.value })}
          className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50"
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {pending && <span className="text-xs text-zinc-500">Updating…</span>}
      </div>
    </div>
  );
}
