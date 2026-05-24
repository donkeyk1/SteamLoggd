"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import type { GameStatus } from "@prisma/client";
import { PLATFORMS } from "@/lib/platforms";

const STATUS_OPTIONS: GameStatus[] = [
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
};

type BulkResult = {
  title: string;
  status: "added" | "duplicate" | "no_match" | "error";
  matched?: string;
};

export function AddGameForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [title, setTitle] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const [picked, setPicked] = useState<Suggestion | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<GameStatus>("UNTRIAGED");
  const [priority, setPriority] = useState(3);
  const [rating, setRating] = useState<number | null>(null);
  const [platform, setPlatform] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastQueryRef = useRef<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  const closeSuggestions = useCallback(() => setSuggestions([]), []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeSuggestions();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeSuggestions]);

  // Debounced IGDB search
  useEffect(() => {
    if (!open) return;
    const q = title.trim();
    if (picked && picked.title === title) return; // user just picked; don't re-search
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      lastQueryRef.current = q;
      setSearching(true);
      try {
        const res = await fetch(`/api/games/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { results?: Suggestion[]; error?: string };
        // Ignore stale responses if user kept typing
        if (lastQueryRef.current !== q) return;
        setSuggestions(data.results ?? []);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [title, open, picked]);

  function pickSuggestion(s: Suggestion) {
    setPicked(s);
    setTitle(s.title);
    setSuggestions([]);
  }

  function clearPicked() {
    setPicked(null);
  }

  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setBulkResults(null);

    const titles = bulkText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30);
    if (titles.length === 0) {
      setSubmitting(false);
      setError("Add at least one title (one per line).");
      return;
    }

    const res = await fetch("/api/games/bulk-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titles,
        status,
        priority,
        ...(platform ? { platform } : {}),
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
    setBulkText("");
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
          : `Failed: ${data.error ?? res.statusText}`
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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
      >
        + Add a game manually
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3">
      <div className="flex gap-1 text-xs">
        <button
          type="button"
          onClick={() => { setMode("single"); setBulkResults(null); setError(null); }}
          className={`px-3 py-1 rounded-md transition-colors ${
            mode === "single"
              ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-medium"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
          }`}
        >
          Single
        </button>
        <button
          type="button"
          onClick={() => { setMode("bulk"); setBulkResults(null); setError(null); }}
          className={`px-3 py-1 rounded-md transition-colors ${
            mode === "bulk"
              ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-medium"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
          }`}
        >
          Bulk
        </button>
      </div>

      {mode === "bulk" ? (
        <BulkAddForm
          bulkText={bulkText}
          setBulkText={setBulkText}
          status={status}
          setStatus={setStatus}
          priority={priority}
          setPriority={setPriority}
          platform={platform}
          setPlatform={setPlatform}
          submitting={submitting}
          onSubmit={handleBulkSubmit}
          onCancel={() => { setOpen(false); setError(null); setBulkResults(null); }}
          results={bulkResults}
          error={error}
        />
      ) : (
    <form
      onSubmit={handleSubmit}
      className="space-y-3"
    >
      <div className="relative">
        <div className="flex flex-wrap gap-3">
          <div ref={containerRef} className="flex-1 min-w-64 relative">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (picked && e.target.value !== picked.title) clearPicked();
              }}
              placeholder="Search for a game (e.g. God of War Ragnarök)…"
              className="w-full px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50"
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 left-0 right-0 max-h-96 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg">
                {suggestions.map((s) => (
                  <li key={s.igdbId}>
                    <button
                      type="button"
                      onClick={() => pickSuggestion(s)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    >
                      {s.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.coverUrl}
                          alt=""
                          className="w-10 h-14 object-cover rounded"
                        />
                      ) : (
                        <div className="w-10 h-14 bg-zinc-200 dark:bg-zinc-800 rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">
                          {s.title}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                          {s.releaseYear ?? "—"}
                          {s.genres.length ? ` · ${s.genres.slice(0, 3).join(", ")}` : ""}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as GameStatus)}
            className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase()}
              </option>
            ))}
          </select>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50"
          >
            <option value="">Platform…</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {status === "BEAT" || status === "DROPPED" ? (
            <select
              value={rating ?? ""}
              onChange={(e) =>
                setRating(e.target.value ? Number(e.target.value) : null)
              }
              className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50"
              title="Your rating"
            >
              <option value="">Rate it…</option>
              {[1, 2, 3, 4, 5].map((r) => (
                <option key={r} value={r}>
                  {"★".repeat(r)}
                  {"☆".repeat(5 - r)}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50"
              title="Priority"
            >
              {[1, 2, 3, 4, 5].map((p) => (
                <option key={p} value={p}>
                  Priority {p}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {picked && (
        <div className="flex items-center gap-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-2">
          {picked.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={picked.coverUrl}
              alt=""
              className="w-8 h-11 object-cover rounded"
            />
          )}
          <div className="flex-1 text-sm">
            <span className="font-medium text-zinc-900 dark:text-zinc-50">
              {picked.title}
            </span>
            {picked.releaseYear ? (
              <span className="ml-2 text-zinc-500">({picked.releaseYear})</span>
            ) : null}
            {picked.genres.length > 0 && (
              <span className="ml-2 text-xs text-zinc-500">
                {picked.genres.slice(0, 3).join(" · ")}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={clearPicked}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
          >
            Clear
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="rounded-md bg-zinc-900 hover:bg-zinc-700 disabled:opacity-50 px-3 py-1.5 text-sm text-white dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {submitting ? "Adding…" : picked ? "Add to backlog" : "Add anyway (no IGDB match)"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Cancel
        </button>
        {searching && (
          <span className="text-xs text-zinc-500">Searching IGDB…</span>
        )}
        {error && (
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
    </form>
      )}
    </div>
  );
}

function BulkAddForm({
  bulkText,
  setBulkText,
  status,
  setStatus,
  priority,
  setPriority,
  platform,
  setPlatform,
  submitting,
  onSubmit,
  onCancel,
  results,
  error,
}: {
  bulkText: string;
  setBulkText: (v: string) => void;
  status: GameStatus;
  setStatus: (v: GameStatus) => void;
  priority: number;
  setPriority: (v: number) => void;
  platform: string;
  setPlatform: (v: string) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  results: BulkResult[] | null;
  error: string | null;
}) {
  const lineCount = bulkText.split("\n").filter((s) => s.trim()).length;

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          rows={6}
          placeholder={"Paste game titles, one per line. Max 30.\n\nGod of War Ragnarök\nHades II\nElden Ring"}
          className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 font-mono"
        />
        <p className="mt-1 text-xs text-zinc-500">
          {lineCount} title{lineCount === 1 ? "" : "s"} · IGDB will look up cover, genres, and HLTB for each
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as GameStatus)}
          className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.toLowerCase()}</option>
          ))}
        </select>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50"
        >
          <option value="">Platform…</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          className="px-3 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50"
        >
          {[1, 2, 3, 4, 5].map((p) => (
            <option key={p} value={p}>Priority {p}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting || lineCount === 0}
          className="rounded-md bg-zinc-900 hover:bg-zinc-700 disabled:opacity-50 px-3 py-1.5 text-sm text-white dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {submitting ? "Adding…" : `Add ${lineCount} game${lineCount === 1 ? "" : "s"}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Cancel
        </button>
        {error && (
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>

      {results && results.length > 0 && (
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-3 space-y-1 max-h-64 overflow-y-auto">
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Results
          </p>
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span
                className={`w-16 shrink-0 font-medium ${
                  r.status === "added"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : r.status === "no_match"
                    ? "text-amber-600 dark:text-amber-400"
                    : r.status === "duplicate"
                    ? "text-zinc-500"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {r.status === "added" ? "✓ added" : r.status === "no_match" ? "no match" : r.status}
              </span>
              <span className="text-zinc-700 dark:text-zinc-300 truncate">
                {r.title}
                {r.matched && r.matched !== r.title && (
                  <span className="text-zinc-500"> → {r.matched}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
