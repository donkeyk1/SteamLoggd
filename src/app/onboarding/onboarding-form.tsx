"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type AvailabilityState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok" }
  | { status: "bad"; reason: "invalid" | "reserved" | "taken" };

const REASON_COPY: Record<"invalid" | "reserved" | "taken", string> = {
  invalid:
    "3–24 characters, letters/numbers/_/-, must start with a letter.",
  reserved: "That username is reserved.",
  taken: "Already taken — pick another.",
};

export function OnboardingForm({
  initialDisplayName,
}: {
  initialDisplayName: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [availability, setAvailability] = useState<AvailabilityState>({
    status: "idle",
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const checkSeqRef = useRef(0);

  function onUsernameChange(value: string) {
    setUsername(value);
    // Immediate visual feedback: any keystroke flips us back into a
    // pending state until the debounced fetch settles.
    setAvailability(value.length === 0 ? { status: "idle" } : { status: "checking" });
  }

  // Debounced fetch. setState only happens asynchronously inside the
  // timeout, so the react-hooks/set-state-in-effect rule is satisfied.
  useEffect(() => {
    if (username.length === 0) return;
    const seq = ++checkSeqRef.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/onboarding/check-username?username=${encodeURIComponent(username)}`
        );
        const data = (await res.json()) as
          | { available: true }
          | { available: false; reason: "invalid" | "reserved" | "taken" };
        if (seq !== checkSeqRef.current) return; // newer keystroke superseded us
        setAvailability(
          data.available
            ? { status: "ok" }
            : { status: "bad", reason: data.reason }
        );
      } catch {
        if (seq !== checkSeqRef.current) return;
        setAvailability({ status: "idle" });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [username]);

  const canSubmit =
    availability.status === "ok" &&
    displayName.trim().length > 0 &&
    !pending;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    startTransition(async () => {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, displayName: displayName.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSubmitError(
          data.error === "username_taken"
            ? "That username got taken between checks — pick another."
            : data.error ?? "Something went wrong."
        );
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Username
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono"
          placeholder="manny"
        />
        <AvailabilityHint state={availability} />
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Display name
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          placeholder="Manny"
        />
      </div>

      {submitError && (
        <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:cursor-not-allowed px-6 py-3 text-white font-semibold transition-colors"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}

function AvailabilityHint({ state }: { state: AvailabilityState }) {
  switch (state.status) {
    case "idle":
      return (
        <p className="text-xs text-zinc-500">
          3–24 characters, must start with a letter.
        </p>
      );
    case "checking":
      return <p className="text-xs text-zinc-500">Checking…</p>;
    case "ok":
      return (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          Available
        </p>
      );
    case "bad":
      return (
        <p className="text-xs text-red-600 dark:text-red-400">
          {REASON_COPY[state.reason]}
        </p>
      );
  }
}
