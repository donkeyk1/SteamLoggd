import type { GameStatus } from "@prisma/client";

const STATUS_MAP: Record<string, { c: string; bg: string; dot?: boolean }> = {
  PLAYING: { c: "var(--hf-cyan)", bg: "var(--hf-cyan-bg)", dot: true },
  "Now Playing": { c: "var(--hf-cyan)", bg: "var(--hf-cyan-bg)", dot: true },
  BEAT: { c: "var(--hf-emerald)", bg: "var(--hf-emerald-bg)" },
  PAUSED: { c: "var(--hf-amber)", bg: "var(--hf-amber-bg)" },
  DROPPED: { c: "var(--hf-rose)", bg: "var(--hf-rose-bg)" },
  WISHLIST: { c: "var(--hf-violet-soft)", bg: "var(--hf-violet-bg)" },
  UNPLAYED: { c: "var(--hf-fg-muted)", bg: "rgba(255,255,255,0.03)" },
  UNTRIAGED: { c: "var(--hf-fg-dim)", bg: "rgba(255,255,255,0.02)" },
};

const STATUS_LABELS: Record<GameStatus, string> = {
  PLAYING: "Playing",
  BEAT: "Beat",
  PAUSED: "Paused",
  DROPPED: "Dropped",
  WISHLIST: "Wishlist",
  UNPLAYED: "Unplayed",
  UNTRIAGED: "Untriaged",
};

export function StatusPill({ status, className = "" }: { status: GameStatus | string; className?: string }) {
  const it = STATUS_MAP[status] || STATUS_MAP.UNPLAYED;
  const label = STATUS_LABELS[status as GameStatus] || status;

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 500,
        color: it.c,
        background: it.bg,
        border: `1px solid color-mix(in srgb, ${it.c} 13%, transparent)`,
        letterSpacing: "-0.005em",
      }}
    >
      {it.dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: it.c,
            boxShadow: `0 0 8px ${it.c}`,
          }}
        />
      )}
      {label}
    </span>
  );
}

export { STATUS_LABELS };
