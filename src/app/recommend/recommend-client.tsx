"use client";

import { useState } from "react";
import type { Mood } from "@/lib/recommender/weights";

const TIME_OPTIONS = [
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "3 hours", minutes: 180 },
  { label: "5+ hours", minutes: 300 },
];

const MOOD_OPTIONS: { value: Mood; label: string }[] = [
  { value: "chill", label: "Chill" },
  { value: "intense", label: "Intense" },
  { value: "story", label: "Story-rich" },
  { value: "multiplayer", label: "Multiplayer" },
  { value: "short-session", label: "Short session" },
];

type Rec = {
  userGameId: string;
  title: string;
  coverUrl?: string | null;
  genres: string[];
  releaseYear?: number | null;
  hltbMainHours?: number | null;
  status: string;
  priority: number;
  score: number;
  why: string;
};

export function RecommendClient() {
  const [selectedMinutes, setSelectedMinutes] = useState(60);
  const [selectedMoods, setSelectedMoods] = useState<Mood[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Rec[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function toggleMood(mood: Mood) {
    setSelectedMoods((prev) =>
      prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood]
    );
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableMinutes: selectedMinutes, moods: selectedMoods }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? res.statusText);
      }
      const data = await res.json();
      setResults(data.recommendations);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const chipClass = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
      active
        ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-50 dark:text-zinc-900 dark:border-zinc-50"
        : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700 dark:hover:bg-zinc-800"
    }`;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          How much time do you have?
        </h2>
        <div className="flex flex-wrap gap-2">
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.minutes}
              type="button"
              onClick={() => setSelectedMinutes(opt.minutes)}
              className={chipClass(selectedMinutes === opt.minutes)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          What are you in the mood for?{" "}
          <span className="font-normal opacity-60">(optional)</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {MOOD_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleMood(value)}
              className={chipClass(selectedMoods.includes(value))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="w-full py-3 rounded-lg bg-zinc-900 text-white font-semibold text-sm hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
      >
        {loading ? "Finding picks…" : "Surprise me"}
      </button>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">Error: {error}</p>
      )}

      {results && (
        <div className="space-y-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Top picks from {total} unplayed / paused game{total === 1 ? "" : "s"}
          </p>
          {results.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No unplayed or paused games — mark some as Unplayed in your backlog first.
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((rec, i) => (
                <div
                  key={rec.userGameId}
                  className="flex gap-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4"
                >
                  <span className="text-2xl font-bold text-zinc-200 dark:text-zinc-700 w-7 shrink-0 self-start pt-0.5">
                    {i + 1}
                  </span>
                  {rec.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={rec.coverUrl}
                      alt=""
                      className="w-14 h-20 object-cover rounded shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-20 rounded bg-zinc-100 dark:bg-zinc-800 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-50 leading-tight">
                      {rec.title}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {rec.releaseYear && <span>{rec.releaseYear}</span>}
                      {rec.hltbMainHours && rec.hltbMainHours > 0 && (
                        <span>~{rec.hltbMainHours.toFixed(0)} h to beat</span>
                      )}
                      <span>Priority {rec.priority}/5</span>
                      {rec.status === "PAUSED" && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          Paused
                        </span>
                      )}
                    </div>
                    {rec.genres.length > 0 && (
                      <div className="text-xs text-zinc-400 dark:text-zinc-500">
                        {rec.genres.slice(0, 3).join(" · ")}
                      </div>
                    )}
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                      {rec.why}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
