"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type EnrichResult = {
  igdbEnriched: number;
  igdbMerged: number;
  igdbCandidates: number;
  ttbEnriched: number;
  ttbNotFound: number;
  ttbCandidates: number;
  pruned: number;
};

export function EnrichButton({ initialUnenriched }: { initialUnenriched: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<EnrichResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setRunning(true);
    try {
      const res = await fetch("/api/enrich/library", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? res.statusText);
      }
      const data = (await res.json()) as EnrichResult;
      setResult(data);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={running}
        className="inline-flex items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        {running ? "Enriching…" : `Enrich library (${initialUnenriched} pending)`}
      </button>
      {result && (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          IGDB matched: {result.igdbEnriched} / {result.igdbCandidates}
          {result.igdbMerged > 0 && ` (+ ${result.igdbMerged} duplicates merged)`}
          {" · "}
          Time-to-beat found: {result.ttbEnriched} / {result.ttbCandidates}
          {result.pruned > 0 && ` · ${result.pruned} unrecognised game${result.pruned === 1 ? "" : "s"} removed`}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">Error: {error}</p>
      )}
    </div>
  );
}
