"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import type { GameStatus } from "@prisma/client";
import { PLATFORMS } from "@/lib/platforms";

const STATUS_OPTIONS: GameStatus[] = [
  "WISHLIST",
  "UNTRIAGED",
  "UNPLAYED",
  "PLAYING",
  "PAUSED",
  "BEAT",
  "DROPPED",
];

type Suggestion = {
  igdbId: number;
  title: string;
  releaseYear?: number;
  coverUrl?: string;
  genres: string[];
  themes: string[];
};

type StagedGame = Suggestion & {
  status: GameStatus;
  priority: number;
  rating: number | null;
  platform: string | null;
};

type BulkResult = {
  title: string;
  status: "added" | "duplicate" | "no_match" | "error";
};

const selectStyle: React.CSSProperties = {
  padding: "5px 8px",
  fontSize: 12,
  borderRadius: 7,
  border: "1px solid var(--hf-border-soft)",
  background: "var(--hf-surface)",
  color: "var(--hf-fg)",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 12px",
  fontSize: 13,
  borderRadius: 9,
  border: "1px solid var(--hf-border-soft)",
  background: "rgba(255,255,255,0.025)",
  color: "var(--hf-fg)",
  outline: "none",
};

export function AddGameForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "bulk">("single");

  const [title, setTitle] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastQueryRef = useRef<string>("");

  const [picked, setPicked] = useState<Suggestion | null>(null);

  const [staged, setStaged] = useState<StagedGame[]>([]);
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const [lastBulkStatus, setLastBulkStatus] = useState<GameStatus>("UNTRIAGED");
  const [lastBulkPriority, setLastBulkPriority] = useState(3);
  const [lastBulkPlatform, setLastBulkPlatform] = useState<string | null>(null);

  const [status, setStatus] = useState<GameStatus>("UNTRIAGED");
  const [priority, setPriority] = useState(3);
  const [rating, setRating] = useState<number | null>(null);
  const [platform, setPlatform] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  const closeSuggestions = useCallback(() => setSuggestions([]), []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        closeSuggestions();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeSuggestions]);

  useEffect(() => {
    if (!open) return;
    const q = title.trim();
    if (mode === "single" && picked && picked.title === title) return;
    if (q.length < 2) {
      setSuggestions([]); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      lastQueryRef.current = q;
      setSearching(true);
      try {
        const res = await fetch(`/api/games/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { results?: Suggestion[]; error?: string };
        if (lastQueryRef.current !== q) return;
        setSuggestions(data.results ?? []);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [title, open, picked, mode]);

  function pickSuggestion(s: Suggestion) {
    if (mode === "bulk") {
      if (!staged.find((g) => g.igdbId === s.igdbId)) {
        setStaged((prev) => [
          ...prev,
          {
            ...s,
            status: lastBulkStatus,
            priority: lastBulkPriority,
            rating: null,
            platform: lastBulkPlatform,
          },
        ]);
      }
      setTitle("");
      setSuggestions([]);
    } else {
      setPicked(s);
      setTitle(s.title);
      setSuggestions([]);
    }
  }

  function removeStaged(igdbId: number) {
    setStaged((prev) => prev.filter((g) => g.igdbId !== igdbId));
  }

  function updateStaged(igdbId: number, patch: Partial<Pick<StagedGame, "status" | "priority" | "rating" | "platform">>) {
    setStaged((prev) => prev.map((g) => (g.igdbId === igdbId ? { ...g, ...patch } : g)));
    if (patch.status !== undefined) setLastBulkStatus(patch.status);
    if (patch.priority !== undefined) setLastBulkPriority(patch.priority);
    if (patch.platform !== undefined) setLastBulkPlatform(patch.platform);
  }

  function clearPicked() {
    setPicked(null);
  }

  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (staged.length === 0) return;
    setSubmitting(true);
    setError(null);
    setBulkResults(null);

    const res = await fetch("/api/games/bulk-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        games: staged.map((s) => ({
          igdbId: s.igdbId,
          title: s.title,
          coverUrl: s.coverUrl,
          genres: s.genres,
          themes: s.themes,
          releaseYear: s.releaseYear,
          status: s.status,
          priority: s.priority,
          rating: s.rating,
          platform: s.platform,
        })),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(`Failed: ${data.error ?? res.statusText}`);
      return;
    }
    const data = (await res.json()) as { results: BulkResult[] };
    setBulkResults(data.results);
    setStaged([]);
    startTransition(() => router.refresh());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const isFinished = status === "BEAT" || status === "DROPPED";
    const payload: Record<string, unknown> = {
      title,
      status,
      priority,
      ...(platform ? { platform } : {}),
      ...(isFinished && rating ? { rating } : {}),
    };
    if (picked) {
      payload.igdbId = picked.igdbId;
      payload.coverUrl = picked.coverUrl;
      payload.genres = picked.genres;
      payload.themes = picked.themes;
      payload.releaseYear = picked.releaseYear;
    }

    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(
        data.error === "already_in_library"
          ? "This game is already in your library."
          : `Failed: ${data.error ?? res.statusText}`,
      );
      return;
    }
    setTitle("");
    setPicked(null);
    setSuggestions([]);
    setStatus("UNTRIAGED");
    setPriority(3);
    setRating(null);
    setPlatform("");
    setOpen(false);
    startTransition(() => router.refresh());
  }

  function closeForm() {
    setOpen(false);
    setError(null);
    setStaged([]);
    setBulkResults(null);
    setPicked(null);
    setTitle("");
    setSuggestions([]);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="hf-btn">
        + Add game
      </button>
    );
  }

  return (
    <div
      className="hf-card"
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
    >
      {/* Mode tabs */}
      <div
        className="flex gap-1"
        style={{
          padding: 3,
          borderRadius: 8,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid var(--hf-border-soft)",
          width: "fit-content",
        }}
      >
        {(["single", "bulk"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setBulkResults(null);
              setStaged([]);
              setPicked(null);
              setTitle("");
              setSuggestions([]);
              setError(null);
            }}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              background: mode === m ? "var(--hf-violet)" : "transparent",
              color: mode === m ? "#fff" : "var(--hf-fg-muted)",
              border: "none",
              cursor: "pointer",
            }}
          >
            {m === "single" ? "Single" : "Bulk"}
          </button>
        ))}
      </div>

      {mode === "bulk" ? (
        <form onSubmit={handleBulkSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Search box */}
          <div ref={searchContainerRef} className="relative">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Search for a game to add…"
              style={inputStyle}
              autoComplete="off"
            />
            {searching && (
              <span
                className="hf-mono absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ fontSize: 11, color: "var(--hf-fg-dim)" }}
              >
                Searching…
              </span>
            )}
            {suggestions.length > 0 && (
              <SuggestionDropdown suggestions={suggestions} onPick={pickSuggestion} />
            )}
          </div>

          {/* Staged list */}
          {staged.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "28rem", overflowY: "auto" }}>
              {staged.map((s) => (
                <div
                  key={s.igdbId}
                  className="flex items-center gap-3"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 9,
                    background: "var(--hf-surface)",
                    border: "1px solid var(--hf-border-soft)",
                  }}
                >
                  {s.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.coverUrl} alt="" className="shrink-0 object-cover" style={{ width: 28, height: 40, borderRadius: 4 }} />
                  ) : (
                    <div className="shrink-0" style={{ width: 28, height: 40, borderRadius: 4, background: "var(--hf-surface-elev)" }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="truncate" style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</div>
                    <div className="hf-mono truncate" style={{ fontSize: 10, color: "var(--hf-fg-dim)" }}>
                      {s.releaseYear ?? "—"}
                      {s.genres.length ? ` · ${s.genres.slice(0, 2).join(", ")}` : ""}
                    </div>
                  </div>
                  <select value={s.status} onChange={(e) => updateStaged(s.igdbId, { status: e.target.value as GameStatus })} style={selectStyle} title="Status">
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt} className="bg-zinc-900">{opt.toLowerCase()}</option>
                    ))}
                  </select>
                  <select value={s.platform ?? ""} onChange={(e) => updateStaged(s.igdbId, { platform: e.target.value || null })} style={selectStyle} title="Platform">
                    <option value="" className="bg-zinc-900">—</option>
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p} className="bg-zinc-900">{p}</option>
                    ))}
                  </select>
                  {s.status === "BEAT" || s.status === "DROPPED" ? (
                    <select value={s.rating ?? ""} onChange={(e) => updateStaged(s.igdbId, { rating: e.target.value ? Number(e.target.value) : null })} style={selectStyle} title="Rating">
                      <option value="" className="bg-zinc-900">Rate…</option>
                      {[1, 2, 3, 4, 5].map((r) => (
                        <option key={r} value={r} className="bg-zinc-900">{"★".repeat(r)}{"☆".repeat(5 - r)}</option>
                      ))}
                    </select>
                  ) : (
                    <select value={s.priority} onChange={(e) => updateStaged(s.igdbId, { priority: Number(e.target.value) })} style={selectStyle} title="Priority">
                      {[1, 2, 3, 4, 5].map((p) => (
                        <option key={p} value={p} className="bg-zinc-900">P{p}</option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => removeStaged(s.igdbId)}
                    style={{ color: "var(--hf-fg-dim)", fontSize: 18, cursor: "pointer", padding: "0 2px", background: "none", border: "none" }}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            {staged.length > 0 && (
              <button type="submit" disabled={submitting} className="hf-btn hf-btn-primary" style={{ fontSize: 13 }}>
                {submitting ? "Adding…" : `Add ${staged.length} game${staged.length === 1 ? "" : "s"}`}
              </button>
            )}
            <button type="button" onClick={closeForm} className="hf-btn" style={{ fontSize: 13 }}>Cancel</button>
            {error && <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-rose)" }}>{error}</span>}
          </div>

          {/* Results */}
          {bulkResults && bulkResults.length > 0 && (
            <div
              style={{
                padding: 12,
                borderRadius: 9,
                background: "var(--hf-surface)",
                border: "1px solid var(--hf-border-soft)",
                maxHeight: 256,
                overflowY: "auto",
              }}
            >
              <p className="hf-cap" style={{ marginBottom: 8 }}>Results</p>
              {bulkResults.map((r, i) => (
                <div key={i} className="flex items-center gap-2" style={{ fontSize: 12, marginBottom: 4 }}>
                  <span
                    className="hf-mono shrink-0"
                    style={{
                      width: 60,
                      fontWeight: 500,
                      color: r.status === "added" ? "var(--hf-emerald)"
                        : r.status === "no_match" ? "var(--hf-amber)"
                        : r.status === "duplicate" ? "var(--hf-fg-dim)"
                        : "var(--hf-rose)",
                    }}
                  >
                    {r.status === "added" ? "added" : r.status === "no_match" ? "no match" : r.status}
                  </span>
                  <span className="truncate" style={{ color: "var(--hf-fg-muted)" }}>{r.title}</span>
                </div>
              ))}
            </div>
          )}
        </form>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="flex flex-wrap gap-2.5">
            <div ref={searchContainerRef} className="flex-1 min-w-64 relative">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (picked && e.target.value !== picked.title) clearPicked();
                }}
                placeholder="Search for a game…"
                style={inputStyle}
                autoComplete="off"
              />
              {suggestions.length > 0 && (
                <SuggestionDropdown suggestions={suggestions} onPick={pickSuggestion} />
              )}
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value as GameStatus)} style={selectStyle}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s} className="bg-zinc-900">{s.toLowerCase()}</option>
              ))}
            </select>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={selectStyle}>
              <option value="" className="bg-zinc-900">Platform…</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p} className="bg-zinc-900">{p}</option>
              ))}
            </select>
            {status === "BEAT" || status === "DROPPED" ? (
              <select value={rating ?? ""} onChange={(e) => setRating(e.target.value ? Number(e.target.value) : null)} style={selectStyle} title="Your rating">
                <option value="" className="bg-zinc-900">Rate it…</option>
                {[1, 2, 3, 4, 5].map((r) => (
                  <option key={r} value={r} className="bg-zinc-900">{"★".repeat(r)}{"☆".repeat(5 - r)}</option>
                ))}
              </select>
            ) : (
              <select value={priority} onChange={(e) => setPriority(Number(e.target.value))} style={selectStyle} title="Priority">
                {[1, 2, 3, 4, 5].map((p) => (
                  <option key={p} value={p} className="bg-zinc-900">Priority {p}</option>
                ))}
              </select>
            )}
          </div>

          {picked && (
            <div
              className="flex items-center gap-3"
              style={{
                padding: "8px 12px",
                borderRadius: 9,
                background: "var(--hf-surface)",
                border: "1px solid var(--hf-border-soft)",
              }}
            >
              {picked.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={picked.coverUrl} alt="" className="object-cover shrink-0" style={{ width: 32, height: 44, borderRadius: 4 }} />
              )}
              <div className="flex-1 min-w-0" style={{ fontSize: 13 }}>
                <span style={{ fontWeight: 500 }}>{picked.title}</span>
                {picked.releaseYear && (
                  <span className="hf-mono" style={{ marginLeft: 8, color: "var(--hf-fg-dim)", fontSize: 11 }}>({picked.releaseYear})</span>
                )}
                {picked.genres.length > 0 && (
                  <span style={{ marginLeft: 8, color: "var(--hf-fg-dim)", fontSize: 12 }}>
                    {picked.genres.slice(0, 3).join(" · ")}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={clearPicked}
                style={{ fontSize: 12, color: "var(--hf-fg-dim)", cursor: "pointer", background: "none", border: "none" }}
              >
                Clear
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button type="submit" disabled={submitting || !title.trim()} className="hf-btn hf-btn-primary" style={{ fontSize: 13 }}>
              {submitting ? "Adding…" : picked ? "Add to backlog" : "Add anyway"}
            </button>
            <button type="button" onClick={closeForm} className="hf-btn" style={{ fontSize: 13 }}>Cancel</button>
            {searching && (
              <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-fg-dim)" }}>Searching IGDB…</span>
            )}
            {error && (
              <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-rose)" }}>{error}</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function SuggestionDropdown({ suggestions, onPick }: { suggestions: Suggestion[]; onPick: (s: Suggestion) => void }) {
  return (
    <ul
      className="absolute z-10 mt-1 left-0 right-0 max-h-96 overflow-y-auto"
      style={{
        borderRadius: 9,
        border: "1px solid var(--hf-border-soft)",
        background: "var(--hf-bg)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
      }}
    >
      {suggestions.map((s) => (
        <li key={s.igdbId}>
          <button
            type="button"
            onClick={() => onPick(s)}
            className="w-full flex items-center gap-3 text-left"
            style={{ padding: "8px 12px", cursor: "pointer", background: "none", border: "none", color: "var(--hf-fg)" }}
            onMouseOver={(e) => (e.currentTarget.style.background = "var(--hf-surface)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "none")}
          >
            {s.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.coverUrl} alt="" className="object-cover shrink-0" style={{ width: 40, height: 56, borderRadius: 4 }} />
            ) : (
              <div className="shrink-0" style={{ width: 40, height: 56, borderRadius: 4, background: "var(--hf-surface-elev)" }} />
            )}
            <div className="flex-1 min-w-0">
              <div className="truncate" style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</div>
              <div className="hf-mono truncate" style={{ fontSize: 11, color: "var(--hf-fg-dim)" }}>
                {s.releaseYear ?? "—"}
                {s.genres.length ? ` · ${s.genres.slice(0, 3).join(", ")}` : ""}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
