"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SyncIcon } from "@/components/ui/icons";

export function SyncSteamButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLastResult(null);

    // Step 1: Sync Steam library
    const syncRes = await fetch("/api/sync/steam", { method: "POST" });
    const syncData = (await syncRes.json()) as
      | { synced: number; total: number }
      | { error: string };

    if ("error" in syncData) {
      setError(syncData.error);
      return;
    }

    let msg = `Synced ${syncData.synced} of ${syncData.total}`;

    // Step 2: Enrich library (auto-run after sync)
    try {
      const enrichRes = await fetch("/api/enrich/library", { method: "POST" });
      if (enrichRes.ok) {
        const enrichData = (await enrichRes.json()) as {
          igdbEnriched: number;
          igdbCandidates: number;
        };
        if (enrichData.igdbEnriched > 0) {
          msg += ` · enriched ${enrichData.igdbEnriched}`;
        }
      }
    } catch {
      // Enrich is best-effort, don't block on failure
    }

    setLastResult(msg);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={handleClick} disabled={pending} className="hf-btn btn-press" style={{ padding: "6px 10px" }}>
        <SyncIcon size={13} /> {pending ? "Syncing…" : "Sync"}
      </button>
      {lastResult && <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-emerald)" }}>{lastResult}</span>}
      {error && <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-rose)" }}>Error: {error}</span>}
    </div>
  );
}
