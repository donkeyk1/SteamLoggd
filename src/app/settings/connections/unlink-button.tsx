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
        className="shrink-0 text-xs text-zinc-500 hover:text-red-500 transition-colors"
      >
        Unlink
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={() => setConfirm(false)}
        className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        Cancel
      </button>
      <button
        onClick={unlink}
        disabled={pending}
        className="rounded-md bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 px-3 py-1.5 text-xs text-white font-medium"
      >
        {pending ? "Unlinking…" : "Confirm unlink"}
      </button>
    </div>
  );
}
