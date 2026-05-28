"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { GameStatus } from "@prisma/client";
import { SearchIcon, ChevronDown } from "@/components/ui/icons";

const UNENRICHED_KEY = "unenriched";
const MULTIPLAYER_KEY = "multiplayer";

const STATUS_TABS: { label: string; value: GameStatus | "all" | typeof UNENRICHED_KEY | typeof MULTIPLAYER_KEY }[] = [
  { label: "All", value: "all" },
  { label: "Untriaged", value: "UNTRIAGED" },
  { label: "Unplayed", value: "UNPLAYED" },
  { label: "Playing", value: "PLAYING" },
  { label: "Paused", value: "PAUSED" },
  { label: "Beat", value: "BEAT" },
  { label: "Wishlist", value: "WISHLIST" },
  { label: "Dropped", value: "DROPPED" },
];

const SORT_LABELS: Record<string, string> = {
  recent: "Recent",
  playtime: "Playtime",
  title: "Title",
  added: "Added",
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
    <div className="flex flex-col gap-3">
      {/* Status filter tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className="flex gap-1"
          style={{
            padding: 4,
            borderRadius: 10,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--hf-border-soft)",
          }}
        >
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
                onClick={() => update({ status: tab.value === "all" ? undefined : tab.value })}
                className="filter-tab-hover"
                style={{
                  padding: "6px 12px",
                  borderRadius: 7,
                  fontSize: 12.5,
                  fontWeight: 500,
                  background: isActive ? "var(--hf-violet)" : "transparent",
                  color: isActive ? "#fff" : "var(--hf-fg-muted)",
                  border: "none",
                  cursor: "pointer",
                  letterSpacing: "-0.005em",
                  boxShadow: isActive ? "0 2px 12px var(--hf-violet-glow)" : "none",
                }}
              >
                {tab.label}
                {isActive && count > 0 && (
                  <span className="hf-mono" style={{ marginLeft: 5, opacity: 0.8, fontSize: 10.5 }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div
          className="flex gap-1"
          style={{
            padding: 4,
            borderRadius: 10,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--hf-border-soft)",
          }}
        >
          <button
            onClick={() => {
              if (isMultiplayerView) update({ status: undefined });
            }}
            className="filter-tab-hover"
            style={{
              padding: "6px 12px",
              borderRadius: 7,
              fontSize: 12.5,
              fontWeight: 500,
              background: "transparent",
              color: !isMultiplayerView ? "var(--hf-fg)" : "var(--hf-fg-dim)",
              border: "none",
              cursor: "pointer",
            }}
          >
            Single-player
          </button>
          <button
            onClick={() => update({ status: MULTIPLAYER_KEY })}
            className="filter-tab-hover"
            style={{
              padding: "6px 12px",
              borderRadius: 7,
              fontSize: 12.5,
              background: "transparent",
              color: isMultiplayerView ? "var(--hf-fg)" : "var(--hf-fg-dim)",
              border: "none",
              cursor: "pointer",
            }}
          >
            Multiplayer
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div
          className="flex items-center gap-2 search-box-hover"
          style={{
            padding: "7px 12px",
            borderRadius: 9,
            background: "rgba(255,255,255,0.025)",
            border: "1px solid var(--hf-border-soft)",
            width: 240,
          }}
        >
          <SearchIcon />
          <input
            type="search"
            defaultValue={query}
            placeholder={`Search ${totalCount} games…`}
            onChange={(e) => update({ q: e.target.value || undefined })}
            className="bg-transparent border-none outline-none flex-1 text-zinc-50"
            style={{ fontSize: 12.5, color: "var(--hf-fg)" }}
          />
          <span className="hf-mono" style={{ fontSize: 10, color: "var(--hf-fg-dim)", padding: "2px 6px", background: "rgba(255,255,255,0.05)", borderRadius: 4 }}>
            ⌘K
          </span>
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => update({ sort: e.target.value })}
            className="hf-btn appearance-none pr-7 cursor-pointer bg-transparent"
            style={{ fontSize: 12 }}
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value} className="bg-zinc-900 text-zinc-50">
                Sort: {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {pending && <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-fg-dim)" }}>Updating…</span>}
    </div>
  );
}
