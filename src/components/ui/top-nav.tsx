import Link from "next/link";
import { Wordmark } from "./wordmark";
import { DiceIcon } from "./icons";
import { BottomNav } from "./bottom-nav";

export function TopNav({
  active = "shuffle",
  username,
  steamLinked = true,
}: {
  active?: "shuffle" | "dashboard" | "backlog";
  username?: string | null;
  steamLinked?: boolean;
}) {
  const items = [
    { id: "shuffle" as const, label: "Shuffle", href: "/recommend" },
    { id: "dashboard" as const, label: "Dashboard", href: "/dashboard" },
    { id: "backlog" as const, label: "Backlog", href: "/backlog" },
  ];

  return (
    <div className="flex flex-col">
      {/* Steam link banner for users without Steam connected */}
      {!steamLinked && (
        <div
          className="flex items-center justify-center gap-2 sm:gap-3 text-center px-3 py-2 sm:px-7"
          style={{
            background: "linear-gradient(90deg, var(--hf-violet-bg) 0%, rgba(34,211,238,0.06) 100%)",
            borderBottom: "1px solid rgba(139,92,246,0.15)",
            fontSize: 12.5,
            color: "var(--hf-fg-muted)",
          }}
        >
          <span>
            Link your <span style={{ color: "var(--hf-fg)", fontWeight: 500 }}>Steam account</span>
            <span className="hidden sm:inline"> to sync your library and track playtime</span>
          </span>
          <a
            href="/api/steam/link/start"
            className="hf-btn btn-press"
            style={{
              fontSize: 12,
              padding: "4px 12px",
              background: "var(--hf-violet)",
              color: "#fff",
              borderColor: "var(--hf-violet)",
              boxShadow: "0 2px 8px var(--hf-violet-glow)",
            }}
          >
            Link Steam
          </a>
        </div>
      )}

      <div
        className="flex items-center justify-between px-4 py-3 sm:px-7"
        style={{
          borderBottom: "1px solid var(--hf-border-soft)",
          background: "rgba(9,9,11,0.85)",
          backdropFilter: "blur(12px)",
          position: "relative",
        }}
      >
        <div className="flex items-center gap-7">
          <Wordmark size={18} href="/dashboard" />
          <nav className="hidden md:flex gap-1">
            {items.map((it) => {
              const isActive = active === it.id;
              const isShuffle = it.id === "shuffle";
              return (
                <Link
                  key={it.id}
                  href={it.href}
                  className="inline-flex items-center gap-[7px] no-underline nav-link-hover"
                  style={{
                    padding: "7px 13px",
                    borderRadius: 8,
                    fontSize: 13.5,
                    fontWeight: 500,
                    letterSpacing: "-0.005em",
                    color: isActive ? "var(--hf-fg)" : "var(--hf-fg-muted)",
                    background: isActive
                      ? isShuffle
                        ? "var(--hf-violet-bg)"
                        : "rgba(255,255,255,0.05)"
                      : "transparent",
                    border: isShuffle
                      ? `1px solid ${isActive ? "rgba(139,92,246,0.53)" : "rgba(139,92,246,0.2)"}`
                      : "1px solid transparent",
                    boxShadow: isShuffle && isActive ? "0 0 24px var(--hf-violet-glow)" : "none",
                  }}
                >
                  {isShuffle && (
                    <DiceIcon
                      size={13}
                      color={isActive ? "var(--hf-violet-soft)" : "var(--hf-violet)"}
                    />
                  )}
                  <span
                    style={{
                      color: isShuffle
                        ? isActive
                          ? "var(--hf-fg)"
                          : "var(--hf-violet-soft)"
                        : "inherit",
                    }}
                  >
                    {it.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="hf-cap">{username || "user"}</span>
          <Link
            href="/settings/profile"
            className="shrink-0 avatar-hover"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: "linear-gradient(135deg, var(--hf-violet), var(--hf-cyan))",
              border: "1px solid var(--hf-border-strong)",
              display: "block",
            }}
          />
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <BottomNav active={active} />
    </div>
  );
}
