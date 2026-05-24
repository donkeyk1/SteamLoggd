"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ProfileForm({
  initialName,
  initialImage,
}: {
  initialName: string;
  initialImage: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [image, setImage] = useState(initialImage);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          image: image.trim() || null,
        }),
      });
      if (res.ok) {
        setMessage("Saved.");
        router.refresh();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setMessage(data.error ?? "Save failed.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500">
          Display name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500">
          Avatar URL
        </label>
        <input
          type="url"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          maxLength={500}
          placeholder="https://…"
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        />
      </div>

      {message && (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">{message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 px-4 py-2 text-sm text-white font-semibold"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
