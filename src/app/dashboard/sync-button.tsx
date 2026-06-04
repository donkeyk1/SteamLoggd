"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SyncIcon } from "@/components/ui/icons";

type SyncResult = {
  synced: number;
  total: number;
  igdbEnriched: number;
  ttbEnriched: number;
  dropped: string[];
  titleMatched?: number;
  titleMatchRemaining?: number;
};

export function SyncButton({ endpoint, label }: { endpoint: string; label: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [droppedDismissed, setDroppedDismissed] = useState(false);

  async function handleClick() {
    setError(null);
    setResult(null);
    setDroppedDismissed(false);
    setRunning(true);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if ("error" in data) throw new Error(data.error);
      setResult(data as SyncResult);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setRunning(false);
    }
  }

  const enriched = result ? result.igdbEnriched + (result.titleMatched ?? 0) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={handleClick}
          disabled={running}
          className="hf-btn btn-press"
          style={{ padding: "6px 10px" }}
        >
          <SyncIcon size={13} /> {running ? "Syncing…" : label}
        </button>

        {result && (
          <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-emerald)" }}>
            {result.synced} games · {enriched} enriched
            {result.ttbEnriched > 0 && ` · ${result.ttbEnriched} HLTB`}
            {result.titleMatchRemaining ? ` · ${result.titleMatchRemaining} more — sync again` : ""}
          </span>
        )}
        {error && (
          <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-rose)" }}>
            Error: {error}
          </span>
        )}
      </div>

      {/* Dropped games warning — shown after sync if any were removed */}
      {result && result.dropped.length > 0 && !droppedDismissed && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(251,191,36,0.08)",
            border: "1px solid rgba(251,191,36,0.3)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            maxWidth: 420,
          }}
        >
          <div className="flex justify-between items-center">
            <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-amber)", letterSpacing: "0.08em" }}>
              {result.dropped.length} GAME{result.dropped.length > 1 ? "S" : ""} NOT ON IGDB — REMOVED
            </span>
            <button
              onClick={() => setDroppedDismissed(true)}
              style={{ fontSize: 12, color: "var(--hf-fg-dim)", background: "none", border: "none", cursor: "pointer", padding: "0 4px" }}
            >
              ✕
            </button>
          </div>
          <p style={{ fontSize: 12, color: "var(--hf-fg-muted)", margin: 0, lineHeight: 1.5 }}>
            These are likely demos, betas, DLC, or soundtracks that the platform counts as games but IGDB doesn&apos;t:
          </p>
          <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 12, color: "var(--hf-fg-dim)", lineHeight: 1.7 }}>
            {result.dropped.slice(0, 10).map((t) => <li key={t}>{t}</li>)}
            {result.dropped.length > 10 && (
              <li style={{ color: "var(--hf-fg-dim)", fontStyle: "italic" }}>
                …and {result.dropped.length - 10} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
