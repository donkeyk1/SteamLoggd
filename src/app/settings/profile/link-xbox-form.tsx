"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function errorMsg(data: { error?: string; detail?: string }): string {
  if (data.error === "gamertag_not_found") return "No Xbox profile found for that gamertag.";
  if (data.error === "already_linked_other") return "That Xbox account is already linked to a different account.";
  if (data.error === "invalid_input") return "Enter a valid gamertag.";
  if (data.error === "xbox_api_error") return `Xbox API error: ${data.detail ?? "unknown"}`;
  return `Error: ${data.error ?? "unknown"}`;
}

export function LinkXboxForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [gamertag, setGamertag] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const gt = gamertag.trim();
    if (!gt) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/xbox/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gamertag: gt }),
      });
      if (res.ok) {
        setGamertag("");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(errorMsg(data));
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" style={{ flex: 1 }}>
      <div className="flex items-center gap-2">
        <input
          value={gamertag}
          onChange={(e) => setGamertag(e.target.value)}
          placeholder="Your gamertag"
          maxLength={50}
          className="hf-mono"
          style={{
            flex: 1,
            fontSize: 13,
            padding: "8px 12px",
            borderRadius: 9,
            background: "var(--hf-bg)",
            border: "1px solid var(--hf-border-soft)",
            color: "var(--hf-fg)",
          }}
        />
        <button
          type="submit"
          disabled={pending || !gamertag.trim()}
          className="hf-btn hf-btn-primary"
          style={{ fontSize: 13, flexShrink: 0, opacity: pending || !gamertag.trim() ? 0.6 : 1 }}
        >
          {pending ? "Linking…" : "Link Xbox"}
        </button>
      </div>
      {error && <span style={{ fontSize: 12, color: "var(--hf-rose)" }}>{error}</span>}
    </form>
  );
}

export function UnlinkXboxButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  function unlink() {
    startTransition(async () => {
      const res = await fetch("/api/xbox/unlink", { method: "POST" });
      if (res.ok) {
        router.refresh();
        setConfirm(false);
      }
    });
  }

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        style={{ fontSize: 12, color: "var(--hf-fg-dim)", cursor: "pointer", background: "none", border: "none" }}
      >
        Unlink
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button onClick={() => setConfirm(false)} className="hf-btn hf-btn-ghost" style={{ fontSize: 12, padding: "4px 8px" }}>
        Cancel
      </button>
      <button
        onClick={unlink}
        disabled={pending}
        className="hf-btn"
        style={{ fontSize: 12, padding: "4px 10px", color: "var(--hf-rose)", borderColor: "rgba(244,63,94,0.3)" }}
      >
        {pending ? "Unlinking…" : "Confirm unlink"}
      </button>
    </div>
  );
}
