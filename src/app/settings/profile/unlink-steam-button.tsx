"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function UnlinkSteamButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  function unlink() {
    startTransition(async () => {
      const res = await fetch("/api/steam/unlink", { method: "POST" });
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
      <button
        onClick={() => setConfirm(false)}
        className="hf-btn hf-btn-ghost"
        style={{ fontSize: 12, padding: "4px 8px" }}
      >
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
