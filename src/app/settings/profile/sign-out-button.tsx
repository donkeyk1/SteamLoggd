"use client";

import { useState } from "react";

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={pending}
      className="hf-btn"
      style={{
        fontSize: 13,
        color: "var(--hf-rose)",
        borderColor: "rgba(244,63,94,0.3)",
        width: "fit-content",
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
