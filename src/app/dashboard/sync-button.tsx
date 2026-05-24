"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SyncSteamButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    const res = await fetch("/api/sync/steam", { method: "POST" });
    const data = (await res.json()) as
      | { synced: number; total: number }
      | { error: string };

    if ("error" in data) {
      setError(data.error);
      return;
    }
    setLastResult(`Synced ${data.synced} of ${data.total} games.`);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center justify-center rounded-lg bg-zinc-900 hover:bg-zinc-700 disabled:opacity-50 px-4 py-2 text-white text-sm font-medium transition-colors dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Syncing…" : "Sync Steam library"}
      </button>
      {lastResult && (
        <p className="text-sm text-green-700 dark:text-green-400">{lastResult}</p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">Error: {error}</p>
      )}
    </div>
  );
}
