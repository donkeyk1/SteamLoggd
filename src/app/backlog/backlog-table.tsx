"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Game, GameStatus, UserGame } from "@prisma/client";
import { PLATFORMS } from "@/lib/platforms";
import { GameCover } from "@/components/ui/game-cover";
import { StatusPill } from "@/components/ui/status-pill";
import { StarIcon } from "@/components/ui/icons";

type Row = UserGame & { game: Game };

const STATUS_OPTIONS: GameStatus[] = [
  "WISHLIST", "UNTRIAGED", "UNPLAYED", "PLAYING", "PAUSED", "BEAT", "DROPPED",
];

function formatPlaytime(minutes: number | null | undefined) {
  if (!minutes) return "—";
  const hours = minutes / 60;
  if (hours < 10) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours)}h`;
}

/** Mobile card — tap the body to (de)select; status & rating/priority are
 *  tappable native pickers; mode/genre/platform/playtime are read-only meta. */
function MobileCard({
  row,
  selected,
  saving,
  showRemove,
  onToggle,
  onPatch,
  onRemove,
}: {
  row: Row;
  selected: boolean;
  saving: boolean;
  showRemove?: boolean;
  onToggle: () => void;
  onPatch: (body: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const isFinished = row.status === "BEAT" || row.status === "DROPPED";
  const platform = row.source === "STEAM" ? "Steam" : row.source === "XBOX" ? "Xbox" : row.platform || null;
  const meta = [
    row.lastPlayedAt ? `last ${row.lastPlayedAt.toLocaleDateString()}` : row.game.releaseYear ? `${row.game.releaseYear}` : "never played",
    platform,
    row.steamPlaytimeMinutes ? formatPlaytime(row.steamPlaytimeMinutes) : null,
  ].filter(Boolean).join(" · ");

  return (
    <div
      onClick={(e) => {
        const tag = (e.target as HTMLElement).tagName;
        if (["SELECT", "OPTION", "BUTTON", "INPUT", "A"].includes(tag)) return;
        onToggle();
      }}
      className="flex gap-3 p-3 rounded-xl"
      style={{
        border: `1px solid ${selected ? "rgba(139,92,246,0.5)" : "var(--hf-border-soft)"}`,
        background: selected
          ? "rgba(139,92,246,0.08)"
          : row.status === "PLAYING"
            ? "rgba(34,211,238,0.04)"
            : "rgba(255,255,255,0.015)",
      }}
    >
      <GameCover name={row.game.title} coverUrl={row.game.coverUrl} w={52} h={70} radius={6} />
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="min-w-0">
          <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.game.title}
          </div>
          <div className="hf-mono" style={{ fontSize: 11, color: "var(--hf-fg-dim)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {meta}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status */}
          <div className="relative">
            <StatusPill status={row.status} />
            <select
              value={row.status}
              disabled={saving}
              onChange={(e) => onPatch({ status: e.target.value as GameStatus })}
              className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-default"
              style={{ width: "100%", height: "100%" }}
              aria-label="Change status"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s} className="bg-zinc-900 text-zinc-50">{s.charAt(0) + s.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>

          {/* Rating (finished) or Priority */}
          <div className="relative">
            {isFinished ? (
              <>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <StarIcon key={j} size={12} color={j < (row.rating ?? 0) ? "var(--hf-amber)" : "var(--hf-fg-faint)"} filled={j < (row.rating ?? 0)} />
                  ))}
                </div>
                <select
                  value={row.rating ?? ""}
                  disabled={saving}
                  onChange={(e) => onPatch({ rating: e.target.value ? Number(e.target.value) : null })}
                  className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-default"
                  style={{ width: "100%", height: "100%" }}
                  aria-label="Change rating"
                >
                  <option value="" className="bg-zinc-900">No rating</option>
                  {[1, 2, 3, 4, 5].map((r) => (
                    <option key={r} value={r} className="bg-zinc-900">{"★".repeat(r)}{"☆".repeat(5 - r)}</option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <PriorityChip level={row.priority} />
                <select
                  value={row.priority >= 4 ? 5 : row.priority >= 3 ? 3 : 1}
                  disabled={saving}
                  onChange={(e) => onPatch({ priority: Number(e.target.value) })}
                  className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-default"
                  style={{ width: "100%", height: "100%" }}
                  aria-label="Change priority"
                >
                  <option value={5} className="bg-zinc-900">High</option>
                  <option value={3} className="bg-zinc-900">Medium</option>
                  <option value={1} className="bg-zinc-900">Low</option>
                </select>
              </>
            )}
          </div>

          {/* Mode (read-only chip) */}
          <span className="hf-mono" style={{ fontSize: 10.5, letterSpacing: "0.04em", color: row.isMultiplayer ? "var(--hf-cyan)" : "var(--hf-fg-dim)" }}>
            {row.isMultiplayer ? "MP" : "SP"}
          </span>

          {row.game.genres.length > 0 && (
            <span style={{ fontSize: 11.5, color: "var(--hf-fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
              {row.game.genres.slice(0, 2).join(" · ")}
            </span>
          )}

          {showRemove && (
            <button
              onClick={onRemove}
              disabled={saving}
              className="hf-btn hf-btn-ghost btn-press ml-auto"
              style={{ padding: "4px 8px", fontSize: 11.5, color: "var(--hf-rose)" }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PriorityChip({ level }: { level: number }) {
  const map: Record<number, { dots: number; color: string; label: string }> = {
    5: { dots: 3, color: "var(--hf-amber)", label: "High" },
    4: { dots: 3, color: "var(--hf-amber)", label: "High" },
    3: { dots: 2, color: "var(--hf-fg-muted)", label: "Med" },
    2: { dots: 1, color: "var(--hf-fg-dim)", label: "Low" },
    1: { dots: 1, color: "var(--hf-fg-dim)", label: "Low" },
  };
  const it = map[level] || map[3];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 4,
              height: 9,
              borderRadius: 1,
              background: i < it.dots ? it.color : "var(--hf-fg-faint)",
              opacity: i < it.dots ? 1 : 0.3,
            }}
          />
        ))}
      </span>
      <span className="hf-mono" style={{ fontSize: 10.5, color: it.color, letterSpacing: "0.04em" }}>
        {it.label}
      </span>
    </span>
  );
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
      <div
        className="flex items-center justify-center"
        style={{
          borderRadius: 14,
          border: "1.5px dashed var(--hf-fg-faint)",
          padding: "48px 20px",
          color: "var(--hf-fg-dim)",
          fontSize: 14,
        }}
      >
        No games match these filters.
      </div>
    );
  }

  const selectStyle = "hf-mono bg-zinc-900 border border-zinc-700 text-zinc-50 rounded px-2 py-1 text-[11px] disabled:opacity-50 cursor-pointer";

  const GRID = "32px 52px minmax(0,2.4fr) 100px 130px 80px minmax(0,1fr) 80px 70px 70px";

  return (
    <div className="flex flex-col gap-2 h-full">
      {error && <p className="hf-mono" style={{ fontSize: 11, color: "var(--hf-rose)" }}>{error}</p>}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div
          className="sticky top-2 z-20 flex flex-wrap items-center gap-2 shadow-lg"
          style={{
            borderRadius: 12,
            border: "1px solid rgba(139,92,246,0.4)",
            background: "rgba(139,92,246,0.08)",
            backdropFilter: "blur(8px)",
            padding: "8px 12px",
          }}
        >
          <span className="hf-mono" style={{ fontSize: 12, color: "var(--hf-violet-soft)", fontWeight: 600, paddingRight: 4 }}>
            {selected.size} selected
          </span>
          <select disabled={bulkBusy} defaultValue="" onChange={(e) => { if (e.target.value) { bulkPatch({ status: e.target.value as GameStatus }); e.target.value = ""; } }} className={selectStyle}>
            <option value="">Set status…</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
          </select>
          <select disabled={bulkBusy} defaultValue="" onChange={(e) => { if (e.target.value) { bulkPatch({ priority: Number(e.target.value) }); e.target.value = ""; } }} className={selectStyle}>
            <option value="">Set priority…</option>
            <option value={5}>High</option>
            <option value={3}>Medium</option>
            <option value={1}>Low</option>
          </select>
          {allSelectedFinished && (
            <select disabled={bulkBusy} defaultValue="" onChange={(e) => { if (e.target.value) { bulkPatch({ rating: Number(e.target.value) }); e.target.value = ""; } }} className={selectStyle}>
              <option value="">Set rating…</option>
              {[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>{"★".repeat(r)}{"☆".repeat(5 - r)}</option>)}
            </select>
          )}
          <button type="button" disabled={bulkBusy} onClick={bulkDelete} className="hf-btn hf-btn-ghost btn-press" style={{ fontSize: 11, padding: "4px 8px", color: "var(--hf-rose)" }}>Remove</button>
          <button type="button" onClick={() => setSelected(new Set())} className="hf-btn hf-btn-ghost btn-press ml-auto" style={{ fontSize: 11, padding: "4px 8px" }}>Clear</button>
        </div>
      )}

      {/* Mobile card list */}
      <div className="md:hidden flex flex-col gap-2">
        {rows.map((row) => (
          <MobileCard
            key={row.id}
            row={row}
            selected={selected.has(row.id)}
            saving={savingId === row.id}
            showRemove={showRemove}
            onToggle={() => toggle(row.id)}
            onPatch={(body) => patch(row.id, body)}
            onRemove={() => remove(row.id)}
          />
        ))}
        <div className="hf-mono" style={{ fontSize: 11.5, color: "var(--hf-fg-dim)", padding: "4px 2px" }}>
          showing {rows.length} game{rows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Desktop table */}
      <div
        className="hidden md:flex flex-col flex-1 min-h-0 overflow-hidden"
        style={{
          borderRadius: 14,
          border: "1px solid var(--hf-border-soft)",
          background: "rgba(255,255,255,0.015)",
        }}
      >
        {/* Header */}
        <div
          className="grid items-center"
          style={{
            gridTemplateColumns: GRID,
            padding: "11px 18px",
            borderBottom: "1px solid var(--hf-border-soft)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div style={{ paddingLeft: 2 }}>
            <input
              type="checkbox"
              checked={rows.length > 0 && selected.size === rows.length}
              ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < rows.length; }}
              onChange={toggleAll}
              className="accent-violet-500 cursor-pointer"
              aria-label="Select all"
            />
          </div>
          {["", "TITLE", "STATUS", "RATING / PRIORITY", "PLAYTIME", "GENRE", "PLATFORM", "MODE", ""].map((h, i) => (
            <span key={i} className="hf-cap">{h}</span>
          ))}
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto hf-scroll">
          {rows.map((row, i) => (
            <div
              key={row.id}
              className="grid items-center table-row-hover cursor-pointer"
              onClick={(e) => {
                // Don't toggle selection when clicking interactive elements (selects, buttons, inputs, links)
                const tag = (e.target as HTMLElement).tagName;
                if (tag === "SELECT" || tag === "OPTION" || tag === "BUTTON" || tag === "INPUT" || tag === "A") return;
                toggle(row.id);
              }}
              style={{
                gridTemplateColumns: GRID,
                padding: "8px 18px",
                borderBottom: i < rows.length - 1 ? "1px solid var(--hf-border-soft)" : "none",
                background: selected.has(row.id)
                  ? "rgba(139,92,246,0.06)"
                  : row.status === "PLAYING"
                    ? "rgba(34,211,238,0.04)"
                    : "transparent",
              }}
            >
              {/* Checkbox */}
              <div style={{ paddingLeft: 2 }}>
                <input
                  type="checkbox"
                  checked={selected.has(row.id)}
                  onChange={() => toggle(row.id)}
                  className="accent-violet-500 cursor-pointer"
                  aria-label={`Select ${row.game.title}`}
                />
              </div>

              {/* Cover */}
              <GameCover name={row.game.title} coverUrl={row.game.coverUrl} w={36} h={50} radius={4} />

              {/* Title */}
              <div style={{ minWidth: 0, paddingRight: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.game.title}
                </div>
                <div className="hf-mono" style={{ fontSize: 11.5, color: "var(--hf-fg-dim)", marginTop: 2 }}>
                  {row.lastPlayedAt ? `last ${row.lastPlayedAt.toLocaleDateString()}` : row.game.releaseYear ? `${row.game.releaseYear}` : "never played"}
                </div>
              </div>

              {/* Status — clickable pill only */}
              <div className="relative inline-edit-hover">
                <StatusPill status={row.status} />
                <select
                  value={row.status}
                  disabled={savingId === row.id}
                  onChange={(e) => patch(row.id, { status: e.target.value as GameStatus })}
                  className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-default"
                  style={{ width: "100%", height: "100%" }}
                  title="Change status"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s} className="bg-zinc-900 text-zinc-50">{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>

              {/* Rating / Priority — clickable */}
              <div className="relative inline-edit-hover">
                {(row.status === "BEAT" || row.status === "DROPPED") ? (
                  <>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <StarIcon key={j} size={11} color={j < (row.rating ?? 0) ? "var(--hf-amber)" : "var(--hf-fg-faint)"} filled={j < (row.rating ?? 0)} />
                      ))}
                    </div>
                    <select
                      value={row.rating ?? ""}
                      disabled={savingId === row.id}
                      onChange={(e) => patch(row.id, { rating: e.target.value ? Number(e.target.value) : null })}
                      className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-default"
                      style={{ width: "100%", height: "100%" }}
                      title="Change rating"
                    >
                      <option value="" className="bg-zinc-900">No rating</option>
                      {[1, 2, 3, 4, 5].map((r) => (
                        <option key={r} value={r} className="bg-zinc-900">{"★".repeat(r)}{"☆".repeat(5 - r)}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <PriorityChip level={row.priority} />
                    <select
                      value={row.priority >= 4 ? 5 : row.priority >= 3 ? 3 : 1}
                      disabled={savingId === row.id}
                      onChange={(e) => patch(row.id, { priority: Number(e.target.value) })}
                      className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-default"
                      style={{ width: "100%", height: "100%" }}
                      title="Change priority"
                    >
                      <option value={5} className="bg-zinc-900">High</option>
                      <option value={3} className="bg-zinc-900">Medium</option>
                      <option value={1} className="bg-zinc-900">Low</option>
                    </select>
                  </>
                )}
              </div>

              {/* Playtime */}
              <span className="hf-mono" style={{ fontSize: 12.5, color: row.steamPlaytimeMinutes ? "var(--hf-fg)" : "var(--hf-fg-faint)", fontVariantNumeric: "tabular-nums" }}>
                {formatPlaytime(row.steamPlaytimeMinutes)}
              </span>

              {/* Genre */}
              <span style={{ fontSize: 12.5, color: "var(--hf-fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
                {row.game.genres?.slice(0, 2).join(" · ") || "—"}
              </span>

              {/* Platform */}
              <span className="hf-mono" style={{ fontSize: 11.5, color: "var(--hf-fg-dim)" }}>
                {row.source === "STEAM" ? "Steam" : row.source === "XBOX" ? "Xbox" : row.platform || "—"}
              </span>

              {/* Mode (SP/MP) — clickable */}
              <div className="relative inline-edit-hover">
                <span
                  className="hf-mono"
                  style={{
                    fontSize: 10.5,
                    letterSpacing: "0.04em",
                    color: row.isMultiplayer ? "var(--hf-cyan)" : "var(--hf-fg-dim)",
                  }}
                >
                  {row.isMultiplayer ? "MP" : "SP"}
                </span>
                <select
                  value={row.isMultiplayer ? "mp" : "sp"}
                  disabled={savingId === row.id}
                  onChange={(e) => patch(row.id, { isMultiplayer: e.target.value === "mp" })}
                  className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-default"
                  style={{ width: "100%", height: "100%" }}
                  title="Change mode"
                >
                  <option value="sp" className="bg-zinc-900">Single-player</option>
                  <option value="mp" className="bg-zinc-900">Multiplayer</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-1 justify-end">
                {showRemove && (
                  <button
                    onClick={() => remove(row.id)}
                    disabled={savingId === row.id}
                    className="hf-btn hf-btn-ghost btn-press"
                    style={{ padding: "4px 8px", fontSize: 11.5, color: "var(--hf-rose)" }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="flex justify-between items-center"
          style={{
            padding: "10px 18px",
            borderTop: "1px solid var(--hf-border-soft)",
            background: "rgba(255,255,255,0.015)",
          }}
        >
          <span className="hf-mono" style={{ fontSize: 11.5, color: "var(--hf-fg-dim)" }}>
            showing {rows.length} game{rows.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
