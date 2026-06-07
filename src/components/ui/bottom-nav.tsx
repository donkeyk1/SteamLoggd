import Link from "next/link";
import { DiceIcon, HomeIcon, LibraryIcon } from "./icons";

type Active = "shuffle" | "dashboard" | "backlog";

const ITEMS: { id: Active; label: string; href: string; Icon: typeof HomeIcon }[] = [
  { id: "shuffle", label: "Shuffle", href: "/recommend", Icon: DiceIcon },
  { id: "dashboard", label: "Home", href: "/dashboard", Icon: HomeIcon },
  { id: "backlog", label: "Backlog", href: "/backlog", Icon: LibraryIcon },
];

/**
 * Fixed bottom tab bar — mobile only (hidden at md+, where the top nav's inline
 * links take over). Pages that scroll on mobile should reserve space for it
 * (the shells add bottom padding).
 */
export function BottomNav({ active = "dashboard" }: { active?: Active }) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
      style={{
        height: "calc(58px + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "rgba(9,9,11,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: "1px solid var(--hf-border-soft)",
      }}
    >
      {ITEMS.map((it) => {
        const isActive = active === it.id;
        const color = isActive ? "var(--hf-violet-soft)" : "var(--hf-fg-dim)";
        return (
          <Link
            key={it.id}
            href={it.href}
            aria-label={it.label}
            aria-current={isActive ? "page" : undefined}
            className="flex-1 flex flex-col items-center justify-center gap-1 no-underline"
            style={{ color }}
          >
            <it.Icon size={22} color={color} />
            <span
              className="hf-mono"
              style={{ fontSize: 10, letterSpacing: "0.04em", fontWeight: isActive ? 600 : 400 }}
            >
              {it.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
