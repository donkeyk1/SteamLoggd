"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ProfileForm({
  initialName,
}: {
  initialName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
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
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <label
          className="hf-cap"
          style={{ display: "block", marginBottom: 8 }}
        >
          Display name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          style={{
            width: "100%",
            padding: "9px 14px",
            fontSize: 14,
            borderRadius: 9,
            border: "1px solid var(--hf-border-soft)",
            background: "rgba(255,255,255,0.025)",
            color: "var(--hf-fg)",
            outline: "none",
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="hf-btn hf-btn-primary"
          style={{ fontSize: 13 }}
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {message && (
          <span
            className="hf-mono"
            style={{
              fontSize: 12,
              color: message === "Saved." ? "var(--hf-emerald)" : "var(--hf-rose)",
            }}
          >
            {message}
          </span>
        )}
      </div>
    </form>
  );
}
