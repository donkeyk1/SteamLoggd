export function ProgressBar({
  pct = 50,
  color = "var(--hf-violet)",
  height = 6,
  glow = true,
  className = "",
}: {
  pct?: number;
  color?: string;
  height?: number;
  glow?: boolean;
  className?: string;
}) {
  return (
    <div className={`hf-progress ${className}`} style={{ height }}>
      <span
        style={{
          width: `${pct}%`,
          background: color,
          boxShadow: glow ? `0 0 12px color-mix(in srgb, ${color} 53%, transparent)` : "none",
        }}
      />
    </div>
  );
}
