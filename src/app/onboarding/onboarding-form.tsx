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

export function OnboardingForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [availability, setAvailability] = useState<AvailabilityState>({
    status: "idle",
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const checkSeqRef = useRef(0);

  function onUsernameChange(value: string) {
    setUsername(value);
    setAvailability(value.length === 0 ? { status: "idle" } : { status: "checking" });
  }

  useEffect(() => {
    if (username.length === 0) return;
    const seq = ++checkSeqRef.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/onboarding/check-username?username=${encodeURIComponent(username)}`,
        );
        const data = (await res.json()) as
          | { available: true }
          | { available: false; reason: "invalid" | "reserved" | "taken" };
        if (seq !== checkSeqRef.current) return;
        setAvailability(
          data.available
            ? { status: "ok" }
            : { status: "bad", reason: data.reason },
        );
      } catch {
        if (seq !== checkSeqRef.current) return;
        setAvailability({ status: "idle" });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [username]);

  const canSubmit = availability.status === "ok" && !pending;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    startTransition(async () => {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSubmitError(
          data.error === "username_taken"
            ? "That username got taken between checks — pick another."
            : data.error ?? "Something went wrong.",
        );
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 w-full">
      <div>
        <label
          className="hf-cap"
          style={{ display: "block", marginBottom: 8 }}
        >
          Username
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="manny"
          className="hf-mono"
          style={{
            width: "100%",
            padding: "10px 14px",
            fontSize: 14,
            borderRadius: 9,
            border: "1px solid var(--hf-border-soft)",
            background: "rgba(255,255,255,0.025)",
            color: "var(--hf-fg)",
            outline: "none",
          }}
        />
        <AvailabilityHint state={availability} />
      </div>

      {submitError && (
        <p className="hf-mono" style={{ fontSize: 12, color: "var(--hf-rose)" }}>
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="hf-btn hf-btn-primary hf-btn-big btn-press w-full justify-center"
        style={{
          opacity: canSubmit ? 1 : 0.5,
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}
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
        <p style={{ fontSize: 12, color: "var(--hf-fg-dim)", marginTop: 6 }}>
          3–24 characters, must start with a letter.
        </p>
      );
    case "checking":
      return (
        <p className="hf-mono" style={{ fontSize: 12, color: "var(--hf-fg-dim)", marginTop: 6 }}>
          Checking…
        </p>
      );
    case "ok":
      return (
        <p className="hf-mono" style={{ fontSize: 12, color: "var(--hf-emerald)", marginTop: 6 }}>
          Available ✓
        </p>
      );
    case "bad":
      return (
        <p className="hf-mono" style={{ fontSize: 12, color: "var(--hf-rose)", marginTop: 6 }}>
          {REASON_COPY[state.reason]}
        </p>
      );
  }
}
