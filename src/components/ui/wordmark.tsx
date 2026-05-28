import Link from "next/link";

export function Wordmark({ size = 18, href }: { size?: number; href?: string }) {
  const content = (
    <div className="flex items-center gap-2" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
      <div
        className="inline-flex items-center justify-center"
        style={{
          width: size + 4,
          height: size + 4,
          borderRadius: 6,
          background: "linear-gradient(135deg, var(--hf-violet), #6366f1)",
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          fontWeight: 700,
          fontSize: size * 0.7,
          color: "#fff",
          boxShadow: "0 4px 18px var(--hf-violet-glow), inset 0 1px 0 rgba(255,255,255,0.2)",
        }}
      >
        S
      </div>
      <span
        style={{
          fontSize: size,
          fontWeight: 600,
          letterSpacing: "-0.025em",
          color: "var(--hf-fg)",
        }}
      >
        SteamLoggd
      </span>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
