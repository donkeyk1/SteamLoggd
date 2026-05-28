"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SparkleIcon } from "@/components/ui/icons";

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
        className="hf-btn"
        style={{ padding: "6px 10px" }}
      >
        <SparkleIcon size={13} /> {running ? "Enriching…" : `Enrich (${initialUnenriched} pending)`}
      </button>
      {result && (
        <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-emerald)" }}>
          IGDB: {result.igdbEnriched}/{result.igdbCandidates}
          {result.igdbMerged > 0 && ` (+${result.igdbMerged} merged)`}
          {" · "}TTB: {result.ttbEnriched}/{result.ttbCandidates}
          {result.pruned > 0 && ` · ${result.pruned} pruned`}
        </span>
      )}
      {error && (
        <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-rose)" }}>Error: {error}</span>
      )}
    </div>
  );
}
