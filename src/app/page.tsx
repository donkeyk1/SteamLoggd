import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Wordmark } from "@/components/ui/wordmark";
import { ArrowRight, SparkleIcon, PlayIcon } from "@/components/ui/icons";

export default async function Home() {
  const session = await getSession();
  if (session) {
    redirect(session.username ? "/dashboard" : "/onboarding");
  }

  return (
    <main
      className="min-h-screen flex flex-col overflow-hidden"
      style={{
        background: "var(--hf-bg)",
        backgroundImage: `radial-gradient(ellipse 80% 60% at 75% 50%, var(--hf-violet-bg) 0%, transparent 60%),
                          radial-gradient(ellipse 60% 50% at 20% 90%, rgba(34,211,238,0.07) 0%, transparent 60%)`,
      }}
    >
      {/* Nav */}
      <header className="flex items-center justify-between px-5 py-4 sm:px-9 sm:py-5 relative z-10 animate-fade">
        <Wordmark size={20} />
        <nav className="flex items-center gap-3 sm:gap-5" style={{ fontSize: 13.5, color: "var(--hf-fg-muted)" }}>
          <Link href="/signin" className="hover:text-white transition-colors" style={{ textDecoration: "none", color: "inherit" }}>
            Sign in
          </Link>
          <Link
            href="/signin"
            className="hf-btn hf-btn-primary btn-press inline-flex items-center gap-2"
            style={{ textDecoration: "none" }}
          >
            Get started <ArrowRight size={13} />
          </Link>
        </nav>
      </header>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-0 px-5 pb-12 pt-6 sm:px-9 sm:pb-7 sm:pt-8 min-h-0">
        {/* LEFT */}
        <section className="flex flex-col justify-center max-w-[620px] pr-0 lg:pr-10 animate-in">
          <div
            className="inline-flex items-center gap-2 self-start mb-4 sm:mb-5"
            style={{
              padding: "5px 11px",
              borderRadius: 999,
              background: "var(--hf-violet-bg)",
              border: "1px solid rgba(139,92,246,0.2)",
              fontSize: 12,
              color: "var(--hf-violet-soft)",
            }}
          >
            <SparkleIcon size={12} /> Now in open beta · free forever
          </div>

          <h1
            className="animate-in stagger-1 text-[44px] sm:text-[62px] lg:text-[76px]"
            style={{
              fontWeight: 600,
              letterSpacing: "-0.045em",
              lineHeight: 0.96,
              margin: 0,
              marginBottom: 22,
            }}
          >
            Stop scrolling.
            <br />
            <span
              className="hf-italic"
              style={{
                backgroundImage: "linear-gradient(90deg, var(--hf-violet-soft), var(--hf-cyan))",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Start playing.
            </span>
          </h1>

          <p
            className="animate-in stagger-2"
            style={{
              fontSize: 16,
              color: "var(--hf-fg-muted)",
              lineHeight: 1.5,
              margin: 0,
              marginBottom: 28,
              letterSpacing: "-0.005em",
              maxWidth: 500,
            }}
          >
            Your backlog, shuffled. Pick your mood, set a time window, and
            let SteamLoggd deal you the one game you should play next.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 mb-8 sm:mb-11 animate-in stagger-3">
            <Link
              href="/signin"
              className="hf-btn hf-btn-primary hf-btn-big btn-press inline-flex items-center justify-center gap-2"
              style={{ textDecoration: "none", fontSize: 16, padding: "14px 24px" }}
            >
              Get started — it&apos;s free <ArrowRight size={14} />
            </Link>
          </div>

          {/* Value props */}
          <div
            className="grid grid-cols-3 gap-2 sm:gap-3.5 pt-5 sm:pt-6 animate-in stagger-4"
            style={{ borderTop: "1px solid var(--hf-border-soft)" }}
          >
            {[
              { n: "01", t: "Shuffle", d: "Mood + time → next game.", c: "var(--hf-violet-soft)" },
              { n: "02", t: "Track", d: "Steam sync + status tags.", c: "var(--hf-cyan)" },
              { n: "03", t: "Discover", d: "Stats, top genres, hall of fame.", c: "var(--hf-emerald)" },
            ].map((v) => (
              <div key={v.n}>
                <span className="hf-mono" style={{ fontSize: 11, color: v.c, letterSpacing: "0.08em" }}>
                  {v.n}
                </span>
                <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em", marginTop: 4 }}>
                  {v.t}
                </div>
                <div style={{ fontSize: 13, color: "var(--hf-fg-muted)", marginTop: 2, lineHeight: 1.35 }}>
                  {v.d}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT — deck preview */}
        <section className="hidden lg:flex items-center justify-center relative animate-in-scale stagger-2">
          <DeckPreview />
        </section>
      </div>

      {/* TODO: Add footer back with real user count & links to Privacy, Terms, GitHub pages once they exist */}
    </main>
  );
}

function DeckPreview() {
  return (
    <div className="relative" style={{ width: 460, height: 600 }}>
      {/* Ambient glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          inset: "15%",
          background: "radial-gradient(circle, var(--hf-violet-glow) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Back cards */}
      {[6, 5, 4, 3].map((i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) translate(${(i - 2) * 12}px, ${(i - 2) * 6}px) rotate(${(i - 3) * 3}deg)`,
            width: 260,
            height: 360,
            borderRadius: 14,
            background: "linear-gradient(155deg, var(--hf-surface) 0%, var(--hf-surface-elev) 50%, var(--hf-surface) 100%)",
            backgroundImage: "repeating-linear-gradient(45deg, rgba(139,92,246,0.07) 0 1px, transparent 1px 8px)",
            border: "1px solid var(--hf-border-soft)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          }}
        />
      ))}

      {/* Top card — revealed with real cover art */}
      <div
        className="absolute flex flex-col gap-2.5"
        style={{
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -52%) rotate(-2deg)",
          width: 280,
          height: 400,
          borderRadius: 14,
          background: "var(--hf-surface)",
          border: "1.5px solid rgba(139,92,246,0.33)",
          padding: 14,
          boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.2), 0 0 60px var(--hf-violet-glow)",
        }}
      >
        <div className="flex justify-between items-center">
          <span className="hf-mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--hf-violet-soft)" }}>
            ★ TOP PICK
          </span>
          <span className="hf-mono" style={{ fontSize: 10, color: "var(--hf-fg-muted)" }}>97% MATCH</span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.igdb.com/igdb/image/upload/t_cover_big/co1sfj.jpg"
          alt="Disco Elysium"
          className="object-cover shrink-0"
          style={{
            width: 252,
            height: 196,
            borderRadius: 10,
            boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
          }}
        />
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.05 }}>
          Disco Elysium
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <span className="hf-pill">RPG</span>
          <span className="hf-pill">Story-rich</span>
          <span className="hf-pill" style={{ color: "var(--hf-violet-soft)" }}>~22h</span>
        </div>
        <div className="hf-btn hf-btn-primary justify-center mt-auto" style={{ pointerEvents: "none" }}>
          <PlayIcon size={12} color="#fff" /> Start playing
        </div>
      </div>

      {/* Annotation chips */}
      <div
        className="absolute"
        style={{
          top: 30,
          right: -10,
          background: "var(--hf-surface)",
          border: "1px solid rgba(34,211,238,0.27)",
          padding: "6px 11px",
          borderRadius: 999,
          fontSize: 11.5,
          color: "var(--hf-cyan)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "var(--hf-cyan)",
            boxShadow: "0 0 8px var(--hf-cyan)",
          }}
        />
        mood: chill · 22h fits weekend
      </div>

      <div
        className="absolute flex flex-col gap-0.5"
        style={{
          bottom: 60,
          left: -16,
          background: "var(--hf-surface)",
          border: "1px solid rgba(139,92,246,0.2)",
          padding: "8px 12px",
          borderRadius: 10,
          fontSize: 12,
          color: "var(--hf-fg-muted)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}
      >
        <span className="hf-mono" style={{ fontSize: 10, color: "var(--hf-violet-soft)", letterSpacing: "0.08em" }}>
          SHUFFLE LIVE
        </span>
        <span>drawing 1 of 102 unplayed</span>
      </div>

      {/* Count chip */}
      <div
        className="absolute hf-mono"
        style={{
          bottom: -10,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 11.5,
          color: "var(--hf-fg-dim)",
          letterSpacing: "0.06em",
        }}
      >
        102 cards in the deck
      </div>
    </div>
  );
}
