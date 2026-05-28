"use client";

import { useState } from "react";

export function DeleteAccountButton() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);

    const res = await fetch("/api/account", { method: "DELETE" });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to delete account.");
      setPending(false);
      return;
    }

    // Account deleted — redirect to home
    window.location.href = "/";
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="hf-btn btn-press"
        style={{
          fontSize: 13,
          color: "var(--hf-rose)",
          borderColor: "rgba(244,63,94,0.3)",
          width: "fit-content",
        }}
      >
        Delete account
      </button>

      {/* Confirmation modal */}
      {showConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
          onClick={(e) => {
            // Close when clicking backdrop
            if (e.target === e.currentTarget) setShowConfirm(false);
          }}
        >
          <div
            className="animate-in-scale"
            style={{
              background: "var(--hf-surface)",
              border: "1px solid var(--hf-border-soft)",
              borderRadius: 16,
              padding: "28px 28px 24px",
              maxWidth: 400,
              width: "100%",
              boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
            }}
          >
            <h2
              style={{
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                margin: "0 0 10px",
                color: "var(--hf-rose)",
              }}
            >
              Delete your account?
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "var(--hf-fg-muted)",
                lineHeight: 1.5,
                margin: "0 0 22px",
              }}
            >
              This will permanently remove your profile, all tracked games,
              ratings, sync history, and linked accounts. This action cannot be
              undone.
            </p>

            {error && (
              <div
                className="hf-mono"
                style={{
                  fontSize: 12,
                  color: "var(--hf-rose)",
                  marginBottom: 14,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "rgba(244,63,94,0.08)",
                  border: "1px solid rgba(244,63,94,0.2)",
                }}
              >
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setError(null);
                }}
                disabled={pending}
                className="hf-btn btn-press"
                style={{ fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={pending}
                className="hf-btn btn-press"
                style={{
                  fontSize: 13,
                  background: "var(--hf-rose)",
                  color: "#fff",
                  borderColor: "var(--hf-rose)",
                  boxShadow: "0 4px 16px rgba(244,63,94,0.3)",
                }}
              >
                {pending ? "Deleting…" : "Delete my account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
