const COVER_STYLES: Record<string, { bg: string; title: string; sub: string; titleStyle?: string; fg?: string }> = {
  "Yakuza 0": { bg: "linear-gradient(155deg, #0a0a0f 0%, #2a0a14 45%, #f43f5e 100%)", title: "ZERO", sub: "YAKUZA", titleStyle: "serif" },
  Hades: { bg: "linear-gradient(180deg, #1a0a05 0%, #b91c1c 60%, #f59e0b 100%)", title: "HADES", sub: "· · ·" },
  "Hades II": { bg: "linear-gradient(180deg, #0a0414 0%, #581c87 50%, #d946ef 100%)", title: "HADES", sub: "II", titleStyle: "serif" },
  "Disco Elysium": { bg: "linear-gradient(155deg, #1e1b4b 0%, #831843 60%, #fb7185 100%)", title: "DISCO", sub: "ELYSIUM" },
  "Elden Ring": { bg: "radial-gradient(circle at 50% 65%, #fbbf24 0%, #a16207 30%, #18181b 75%)", title: "ELDEN", sub: "RING", titleStyle: "serif" },
  "Hollow Knight": { bg: "linear-gradient(180deg, #020617 0%, #1e293b 100%)", title: "HOLLOW", sub: "KNIGHT" },
  "Stardew Valley": { bg: "linear-gradient(180deg, #0f172a 0%, #166534 55%, #84cc16 100%)", title: "STARDEW", sub: "VALLEY" },
  "Outer Wilds": { bg: "radial-gradient(circle at 50% 35%, #fcd34d 0%, #b45309 25%, #18181b 75%)", title: "OUTER", sub: "WILDS" },
  "Cyberpunk 2077": { bg: "linear-gradient(135deg, #fde047 0%, #facc15 40%, #0a0a0a 100%)", title: "CYBER", sub: "2077", fg: "#0a0a0a" },
  Tunic: { bg: "linear-gradient(180deg, #14532d 0%, #4d7c0f 60%, #fde047 100%)", title: "TUNIC", sub: "◆" },
  Pentiment: { bg: "linear-gradient(180deg, #1c1917 0%, #78350f 60%, #fde68a 100%)", title: "PENTI-", sub: "MENT", titleStyle: "serif" },
  "Sonic Mania": { bg: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #fbbf24 100%)", title: "SONIC", sub: "MANIA" },
  Celeste: { bg: "linear-gradient(180deg, #312e81 0%, #7c3aed 60%, #f0abfc 100%)", title: "CELESTE", sub: "⌃" },
  "Slay the Spire": { bg: "linear-gradient(180deg, #1e1b4b 0%, #7c2d12 60%, #fbbf24 100%)", title: "SLAY", sub: "THE SPIRE" },
  Subnautica: { bg: "linear-gradient(180deg, #0c4a6e 0%, #0891b2 60%, #67e8f9 100%)", title: "SUBNAU-", sub: "TICA" },
  "Baldur's Gate 3": { bg: "linear-gradient(180deg, #1c1917 0%, #7c2d12 50%, #ea580c 100%)", title: "BG3", sub: "· · ·", titleStyle: "serif" },
  Returnal: { bg: "radial-gradient(circle at 30% 30%, #ec4899 0%, #831843 40%, #0a0a0a 80%)", title: "RETURNAL", sub: "↻" },
  "GTA V": { bg: "linear-gradient(135deg, #052e16 0%, #166534 60%, #fef08a 100%)", title: "GTA", sub: "V" },
  "Ghost of Tsushima": { bg: "linear-gradient(180deg, #1c1917 0%, #7f1d1d 50%, #fde68a 100%)", title: "GHOST", sub: "OF TSUSHIMA" },
  "God of War": { bg: "linear-gradient(180deg, #18181b 0%, #44403c 50%, #f97316 100%)", title: "GOD", sub: "OF WAR", titleStyle: "serif" },
  "Witcher 3": { bg: "linear-gradient(180deg, #0c0a09 0%, #292524 60%, #dc2626 100%)", title: "WITCHER", sub: "III", titleStyle: "serif" },
};

const FALLBACK_PALETTES = [
  ["#1e293b", "#7c2d12", "#f97316"],
  ["#0c0a09", "#7f1d1d", "#fbbf24"],
  ["#1e1b4b", "#581c87", "#c084fc"],
  ["#0c4a6e", "#0e7490", "#a5f3fc"],
  ["#14532d", "#166534", "#bef264"],
  ["#1c1917", "#44403c", "#d6d3d1"],
  ["#831843", "#be185d", "#fb7185"],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function coverFor(name: string) {
  if (COVER_STYLES[name]) return COVER_STYLES[name];
  const p = FALLBACK_PALETTES[hash(name) % FALLBACK_PALETTES.length];
  const words = name.toUpperCase().split(/\s+/);
  return {
    bg: `linear-gradient(${135 + (hash(name) % 60)}deg, ${p[0]} 0%, ${p[1]} 55%, ${p[2]} 100%)`,
    title: words[0]?.slice(0, 8) || name.toUpperCase(),
    sub: words.slice(1).join(" ").slice(0, 12) || "·",
  };
}

export function GameCover({
  name,
  coverUrl,
  w,
  h,
  radius = 6,
  glow = false,
  className = "",
}: {
  name: string;
  coverUrl?: string | null;
  w?: number;
  h?: number;
  radius?: number;
  glow?: boolean;
  className?: string;
}) {
  const width = w || "100%";
  const height = h || "auto";

  if (coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coverUrl}
        alt={name}
        className={`object-cover shrink-0 ${className}`}
        style={{
          width: typeof width === "number" ? width : undefined,
          height: typeof height === "number" ? height : undefined,
          borderRadius: radius,
          boxShadow: glow
            ? "0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)"
            : "0 4px 18px rgba(0,0,0,0.4)",
        }}
      />
    );
  }

  const c = coverFor(name || "Unknown");
  const titleSize = typeof w === "number" ? Math.max(8, w * 0.13) : 14;
  const subSize = typeof w === "number" ? Math.max(6, w * 0.07) : 9;

  return (
    <div
      className={`relative overflow-hidden flex flex-col justify-end shrink-0 ${className}`}
      style={{
        width: typeof width === "number" ? width : undefined,
        height: typeof height === "number" ? height : undefined,
        aspectRatio: typeof h === "number" ? undefined : "3/4",
        borderRadius: radius,
        background: c.bg,
        border: "1px solid var(--hf-border-soft)",
        boxShadow: glow
          ? "0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)"
          : "0 4px 18px rgba(0,0,0,0.4)",
        padding: typeof w === "number" ? Math.max(4, w * 0.06) : 8,
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.08), transparent 50%)",
        }}
      />
      <div
        style={{
          fontFamily: c.titleStyle === "serif"
            ? '"Instrument Serif", "Playfair Display", Georgia, serif'
            : "var(--font-geist-sans), system-ui, sans-serif",
          fontWeight: c.titleStyle === "serif" ? 400 : 900,
          fontStyle: c.titleStyle === "serif" ? "italic" : "normal",
          fontSize: titleSize,
          letterSpacing: c.titleStyle === "serif" ? "-0.02em" : "-0.04em",
          color: c.fg || "#fff",
          textShadow: "0 1px 8px rgba(0,0,0,0.4)",
          lineHeight: 0.95,
        }}
      >
        {c.title}
      </div>
      <div
        className="hf-mono"
        style={{
          fontSize: subSize,
          letterSpacing: "0.1em",
          color: c.fg ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.75)",
          marginTop: 2,
          textShadow: "0 1px 4px rgba(0,0,0,0.4)",
        }}
      >
        {c.sub}
      </div>
    </div>
  );
}
