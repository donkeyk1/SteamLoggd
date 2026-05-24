"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Game, GameStatus, UserGame } from "@prisma/client";
import { PLATFORMS } from "@/lib/platforms";

type Row = UserGame & { game: Game };

const STATUS_OPTIONS: GameStatus[] = [
  "UNTRIAGED",
  "UNPLAYED",
  "PLAYING",
  "PAUSED",
  "BEAT",
  "DROPPED",
];

function formatPlaytime(minutes: number | null | undefined) {
  if (!minutes) return "—";
  const hours = minutes / 60;
  if (hours < 10) return `${hours.toFixed(1)} h`;
  return `${Math.round(hours)} h`;
}

export function BacklogTable({
  rows,
  showRemove,
}: {
  rows: Row[];
  showRemove?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }

  async function bulkPatch(updates: Record<string, unknown>) {
    if (selected.size === 0) return;
    setBulkBusy(true);
    setError(null);
    const res = await fetch("/api/games/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected], updates }),
    });
    setBulkBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(`Bulk update failed: ${data.error ?? res.statusText}`);
      return;
    }
    setSelected(new Set());
    startTransition(() => router.refresh());
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Remove ${selected.size} game${selected.size === 1 ? "" : "s"} from your library?`)) return;
    setBulkBusy(true);
    setError(null);
    const res = await fetch("/api/games/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected] }),
    });
    setBulkBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(`Bulk remove failed: ${data.error ?? res.statusText}`);
      return;
    }
    setSelected(new Set());
    startTransition(() => router.refresh());
  }

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const allSelectedFinished =
    selectedRows.length > 0 &&
    selectedRows.every((r) => r.status === "BEAT" || r.status === "DROPPED");

  async function patch(id: string, body: Record<string, unknown>) {
    setSavingId(id);
    setError(null);
    const res = await fetch(`/api/games/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSavingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(`Failed to update: ${data.error ?? res.statusText}`);
      return;
    }
    startTransition(() => router.refresh());
  }

  async function remove(id: string) {
    setSavingId(id);
    setError(null);
    const res = await fetch(`/api/games/${id}`, { method: "DELETE" });
    setSavingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(`Failed to remove: ${data.error ?? res.statusText}`);
      return;
    }
    startTransition(() => router.refresh());
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
        No games match these filters.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 rounded-lg border border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-950/80 backdrop-blur p-2.5 flex flex-wrap items-center gap-2 shadow-lg">
          <span className="text-sm font-medium text-violet-900 dark:text-violet-100 px-1">
            {selected.size} selected
          </span>
          <select
            disabled={bulkBusy}
            defaultValue=""
            onChange={(e) => {
              if (!e.target.value) return;
              bulkPatch({ status: e.target.value as GameStatus });
              e.target.value = "";
            }}
            className="px-2 py-1 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 disabled:opacity-50"
          >
            <option value="">Set status…</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.toLowerCase()}</option>
            ))}
          </select>
          <select
            disabled={bulkBusy}
            defaultValue=""
            onChange={(e) => {
              if (!e.target.value) return;
              bulkPatch({ priority: Number(e.target.value) });
              e.target.value = "";
            }}
            className="px-2 py-1 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 disabled:opacity-50"
          >
            <option value="">Set priority…</option>
            {[1, 2, 3, 4, 5].map((p) => (
              <option key={p} value={p}>P{p}</option>
            ))}
          </select>
          {allSelectedFinished && (
            <select
              disabled={bulkBusy}
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                bulkPatch({ rating: Number(e.target.value) });
                e.target.value = "";
              }}
              className="px-2 py-1 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 disabled:opacity-50"
            >
              <option value="">Set rating…</option>
              {[1, 2, 3, 4, 5].map((r) => (
                <option key={r} value={r}>
                  {"★".repeat(r)}{"☆".repeat(5 - r)}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => bulkPatch({ isMultiplayer: true })}
            className="px-2 py-1 text-xs rounded-md border border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950 disabled:opacity-50"
          >
            Mark MP
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => bulkPatch({ isMultiplayer: false })}
            className="px-2 py-1 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            Unmark MP
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={bulkDelete}
            className="px-2 py-1 text-xs rounded-md border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 disabled:opacity-50"
          >
            Remove
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
          >
            Clear
          </button>
        </div>
      )}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selected.size === rows.length}
                  ref={(el) => {
                    if (el) el.indeterminate = selected.size > 0 && selected.size < rows.length;
                  }}
                  onChange={toggleAll}
                  className="accent-violet-500 cursor-pointer"
                  aria-label="Select all"
                />
              </th>
              <th className="font-medium px-4 py-2 w-14"></th>
              <th className="text-left font-medium px-4 py-2">Game</th>
              <th className="text-left font-medium px-4 py-2 w-40">Status</th>
              <th className="text-center font-medium px-4 py-2 w-32">Priority / Rating</th>
              <th className="text-right font-medium px-4 py-2 w-24">Playtime</th>
              <th className="text-right font-medium px-4 py-2 w-24">HLTB</th>
              <th className="text-right font-medium px-4 py-2 w-32">Last played</th>
              <th className="text-left font-medium px-4 py-2 w-32">Platform</th>
              <th className="px-3 py-2 w-12" title="Multiplayer"></th>
              {showRemove && <th className="px-4 py-2 w-20"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`${
                  selected.has(row.id)
                    ? "bg-violet-50 dark:bg-violet-950/30"
                    : "bg-white dark:bg-zinc-950"
                }`}
              >
                <td className="px-3 py-1">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                    className="accent-violet-500 cursor-pointer"
                    aria-label={`Select ${row.game.title}`}
                  />
                </td>
                <td className="pl-4 py-1">
                  {row.game.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.game.coverUrl}
                      alt=""
                      className="w-8 h-11 object-cover rounded"
                    />
                  ) : (
                    <div className="w-8 h-11 rounded bg-zinc-200 dark:bg-zinc-800" />
                  )}
                </td>
                <td className="px-4 py-2 text-zinc-900 dark:text-zinc-50">
                  <div>{row.game.title}</div>
                  {row.game.releaseYear && (
                    <div className="text-xs text-zinc-500">
                      {row.game.releaseYear}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <select
                    value={row.status}
                    disabled={savingId === row.id}
                    onChange={(e) =>
                      patch(row.id, { status: e.target.value as GameStatus })
                    }
                    className="px-2 py-1 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 disabled:opacity-50"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.toLowerCase()}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  {row.status === "BEAT" || row.status === "DROPPED" ? (
                    <div className="flex flex-col items-center gap-1">
                      <select
                        value={row.rating ?? ""}
                        disabled={savingId === row.id}
                        onChange={(e) =>
                          patch(row.id, {
                            rating: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="px-2 py-1 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 disabled:opacity-50"
                        title="Your rating (1–5)"
                      >
                        <option value="">— rate</option>
                        {[1, 2, 3, 4, 5].map((r) => (
                          <option key={r} value={r}>
                            {"★".repeat(r)}{"☆".repeat(5 - r)}
                          </option>
                        ))}
                      </select>
                      {row.status === "BEAT" && (
                        <button
                          onClick={() =>
                            patch(row.id, { wantReplay: !row.wantReplay })
                          }
                          disabled={savingId === row.id}
                          title={
                            row.wantReplay
                              ? "In recommendations — click to remove"
                              : "Mark for replay (adds to recommendations)"
                          }
                          className={`px-1.5 py-0.5 text-[10px] rounded font-medium transition-colors disabled:opacity-50 ${
                            row.wantReplay
                              ? "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30"
                              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                          }`}
                        >
                          ↻ {row.wantReplay ? "replay" : "replay?"}
                        </button>
                      )}
                      {row.status === "BEAT" && row.wantReplay && (
                        <select
                          value={row.priority}
                          disabled={savingId === row.id}
                          onChange={(e) =>
                            patch(row.id, { priority: Number(e.target.value) })
                          }
                          className="px-2 py-0.5 text-[10px] rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 disabled:opacity-50"
                          title="Replay priority (1 = lowest, 5 = highest)"
                        >
                          {[1, 2, 3, 4, 5].map((p) => (
                            <option key={p} value={p}>P{p}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <select
                        value={row.priority}
                        disabled={savingId === row.id}
                        onChange={(e) =>
                          patch(row.id, { priority: Number(e.target.value) })
                        }
                        className="px-2 py-1 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 disabled:opacity-50"
                        title="Priority (1 = lowest, 5 = highest)"
                      >
                        {[1, 2, 3, 4, 5].map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">
                  {formatPlaytime(row.steamPlaytimeMinutes)}
                </td>
                <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">
                  {row.game.hltbMainHours && row.game.hltbMainHours > 0
                    ? `${row.game.hltbMainHours.toFixed(0)} h`
                    : "—"}
                </td>
                <td className="px-4 py-2 text-right text-zinc-600 dark:text-zinc-400">
                  {row.lastPlayedAt
                    ? row.lastPlayedAt.toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-2 text-xs">
                  {row.source === "STEAM" ? (
                    <span className="text-zinc-500 dark:text-zinc-500">Steam</span>
                  ) : (
                    <select
                      value={row.platform ?? ""}
                      disabled={savingId === row.id}
                      onChange={(e) =>
                        patch(row.id, { platform: e.target.value || null })
                      }
                      className="px-1.5 py-0.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 disabled:opacity-50"
                    >
                      <option value="">— platform</option>
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => patch(row.id, { isMultiplayer: !row.isMultiplayer })}
                    disabled={savingId === row.id}
                    title={row.isMultiplayer ? "Multiplayer — click to move to single-player" : "Mark as multiplayer"}
                    className={`px-1.5 py-0.5 text-xs rounded font-medium transition-colors disabled:opacity-50 ${
                      row.isMultiplayer
                        ? "bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700"
                        : "text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400"
                    }`}
                  >
                    MP
                  </button>
                </td>
                {showRemove && (
                  <td className="px-4 py-2">
                    <button
                      onClick={() => remove(row.id)}
                      disabled={savingId === row.id}
                      className="px-2 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
