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

function linkErrorMsg(data: { error?: string; detail?: string }): string {
  if (data.error === "gamertag_not_found") return "Gamertag not found — check the spelling.";
  if (data.error === "already_linked_other") return "That Xbox account belongs to a different user.";
  if (data.error === "invalid_input") return "Enter a valid gamertag.";
  // Surface raw API errors so response-shape issues are visible.
  if (data.error === "xbox_api_error") return `Xbox API error: ${data.detail ?? "unknown"}`;
  return `Error: ${data.error ?? "unknown"}`;
}

export function XboxDashboardButton({ linked }: { linked: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // ── Link state (only relevant when not yet linked) ──
  const [gamertag, setGamertag] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // ── Sync state (only relevant when linked) ──
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [droppedDismissed, setDroppedDismissed] = useState(false);

  // ── Link ──
  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    const gt = gamertag.trim();
    if (!gt) return;
    setLinkError(null);
    setLinking(true);
    try {
      const res = await fetch("/api/xbox/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gamertag: gt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLinkError(linkErrorMsg(data));
        return;
      }
      // Refresh the page so the server re-reads the linked state and shows
      // the sync button.
      startTransition(() => router.refresh());
    } catch {
      setLinkError("Network error — try again.");
    } finally {
      setLinking(false);
    }
  }

  // ── Sync ──
  async function handleSync() {
    setSyncError(null);
    setSyncResult(null);
    setDroppedDismissed(false);
    setSyncing(true);
    try {
      const res = await fetch("/api/sync/xbox", { method: "POST" });
      const data = await res.json();
      if ("error" in data) throw new Error(data.error);
      setSyncResult(data as SyncResult);
      startTransition(() => router.refresh());
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setSyncing(false);
    }
  }

  // ── Not linked → compact link form ──
  if (!linked) {
    return (
      <div className="flex flex-col gap-1.5">
        <form onSubmit={handleLink} className="flex items-center gap-2">
          <input
            value={gamertag}
            onChange={(e) => setGamertag(e.target.value)}
            placeholder="Xbox gamertag"
            maxLength={50}
            className="hf-mono"
            style={{
              fontSize: 12,
              padding: "5px 10px",
              borderRadius: 8,
              background: "var(--hf-bg)",
              border: "1px solid var(--hf-border-soft)",
              color: "var(--hf-fg)",
              width: 150,
            }}
          />
          <button
            type="submit"
            disabled={linking || !gamertag.trim()}
            className="hf-btn btn-press"
            style={{ padding: "6px 10px", fontSize: 12, opacity: linking || !gamertag.trim() ? 0.6 : 1 }}
          >
            {linking ? "Linking…" : "Link Xbox"}
          </button>
        </form>
        {linkError && (
          <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-rose)" }}>
            {linkError}
          </span>
        )}
      </div>
    );
  }

  // ── Linked → sync button (mirrors SyncButton layout) ──
  const enriched = syncResult
    ? syncResult.igdbEnriched + (syncResult.titleMatched ?? 0)
    : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="hf-btn btn-press"
          style={{ padding: "6px 10px" }}
        >
          <SyncIcon size={13} /> {syncing ? "Syncing…" : "Sync Xbox"}
        </button>
        {syncResult && (
          <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-emerald)" }}>
            {syncResult.synced} games · {enriched} enriched
            {syncResult.ttbEnriched > 0 && ` · ${syncResult.ttbEnriched} HLTB`}
            {syncResult.titleMatchRemaining
              ? ` · ${syncResult.titleMatchRemaining} more — sync again`
              : ""}
          </span>
        )}
        {syncError && (
          <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-rose)" }}>
            Error: {syncError}
          </span>
        )}
      </div>

      {syncResult && syncResult.dropped.length > 0 && !droppedDismissed && (
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
              {syncResult.dropped.length} GAME{syncResult.dropped.length > 1 ? "S" : ""} NOT ON IGDB — REMOVED
            </span>
            <button
              onClick={() => setDroppedDismissed(true)}
              style={{ fontSize: 12, color: "var(--hf-fg-dim)", background: "none", border: "none", cursor: "pointer", padding: "0 4px" }}
            >
              ✕
            </button>
          </div>
          <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 12, color: "var(--hf-fg-dim)", lineHeight: 1.7 }}>
            {syncResult.dropped.slice(0, 10).map((t) => <li key={t}>{t}</li>)}
            {syncResult.dropped.length > 10 && (
              <li style={{ fontStyle: "italic" }}>…and {syncResult.dropped.length - 10} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
