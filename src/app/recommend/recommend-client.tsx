"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { Mood } from "@/lib/recommender/weights";
import { GameCover } from "@/components/ui/game-cover";
import { DiceIcon, PlayIcon } from "@/components/ui/icons";

const MOODS: { id: Mood; label: string; icon: string }[] = [
  { id: "chill", label: "Chill", icon: "🍃" },
  { id: "intense", label: "Intense", icon: "⚡" },
  { id: "story", label: "Story-rich", icon: "📖" },
  { id: "multiplayer", label: "Multiplayer", icon: "🎮" },
  { id: "short-session", label: "Short session", icon: "⏱" },
];

const TIMES = [
  { id: "quick", label: "Quick", sub: "< 1h", minutes: 60 },
  { id: "med", label: "Medium", sub: "1–3h", minutes: 120 },
  { id: "long", label: "Long", sub: "3h+", minutes: 300 },
  { id: "srp", label: "Surprise", sub: "any", minutes: 180 },
];

type Rec = {
  userGameId: string;
  title: string;
  coverUrl?: string | null;
  genres: string[];
  releaseYear?: number | null;
  hltbMainHours?: number | null;
  status: string;
  priority: number;
  score: number;
  why: string;
};

type Phase = "setup" | "shuffling" | "revealing" | "reveal" | "empty";

export function RecommendClient({ unplayedCount }: { unplayedCount: number }) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedTime, setSelectedTime] = useState("med");
  const [selectedMoods, setSelectedMoods] = useState<Mood[]>([]);
  const [result, setResult] = useState<Rec | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function toggleMood(mood: Mood) {
    setSelectedMoods((prev) =>
      prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood],
    );
  }

  const selectedMinutes = TIMES.find((t) => t.id === selectedTime)?.minutes ?? 120;

  async function submit() {
    setPhase("shuffling");
    setError(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableMinutes: selectedMinutes, moods: selectedMoods }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? res.statusText);
      }
      const data = await res.json();
      setTotal(data.total);

      // Let the shuffle animation play for at least 2.5s
      await new Promise((r) => setTimeout(r, 2500));

      if (data.recommendations.length === 0) {
        setPhase("empty");
      } else {
        setResult(data.recommendations[0]);
        // Brief "revealing" phase for the card-flip animation
        setPhase("revealing");
        await new Promise((r) => setTimeout(r, 900));
        setPhase("reveal");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setPhase("setup");
    }
  }

  function reset() {
    setPhase("setup");
    setResult(null);
    setTotal(0);
  }

  if (phase === "shuffling") return <ShufflingState unplayedCount={unplayedCount} selectedMoods={selectedMoods} />;
  if (phase === "revealing" && result) return <RevealingState rec={result} />;
  if (phase === "reveal" && result) {
    return <RevealState rec={result} total={total} onRedraw={submit} onReset={reset} />;
  }
  if (phase === "empty") return <EmptyState onReset={reset} unplayedCount={unplayedCount} />;

  return (
    <SetupState
      selectedTime={selectedTime}
      selectedMoods={selectedMoods}
      unplayedCount={unplayedCount}
      error={error}
      onTimeSelect={setSelectedTime}
      onMoodToggle={toggleMood}
      onSubmit={submit}
    />
  );
}

/* ============ SETUP ============ */

function SetupState({
  selectedTime,
  selectedMoods,
  unplayedCount,
  error,
  onTimeSelect,
  onMoodToggle,
  onSubmit,
}: {
  selectedTime: string;
  selectedMoods: Mood[];
  unplayedCount: number;
  error: string | null;
  onTimeSelect: (id: string) => void;
  onMoodToggle: (mood: Mood) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="animate-fade" style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 36, flex: 1, minHeight: 0 }}>
      {/* LEFT — controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: 22, paddingTop: 8 }}>
        <div>
          <div className="hf-cap" style={{ marginBottom: 8 }}>STEP 01 · TUNE THE DECK</div>
          <h1 style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.035em", margin: 0, lineHeight: 1 }}>
            What should I<br />
            <span className="hf-italic" style={{ color: "var(--hf-violet-soft)" }}>play next?</span>
          </h1>
          <p style={{ fontSize: 14.5, color: "var(--hf-fg-muted)", marginTop: 10, lineHeight: 1.5, maxWidth: 460 }}>
            Tell us your mood and how much time you&apos;ve got. We&apos;ll deal you one game from your unplayed pile.
          </p>
        </div>

        {/* Mood */}
        <div>
          <div className="flex justify-between items-baseline" style={{ marginBottom: 10 }}>
            <span className="hf-cap">Mood</span>
            <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-fg-dim)" }}>multi-select</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 7 }}>
            {MOODS.map((m) => (
              <MoodCard key={m.id} mood={m} active={selectedMoods.includes(m.id)} onClick={() => onMoodToggle(m.id)} />
            ))}
          </div>
        </div>

        {/* Time */}
        <div>
          <div className="hf-cap" style={{ marginBottom: 10 }}>How much time?</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7 }}>
            {TIMES.map((t) => (
              <TimeBtn key={t.id} t={t} active={selectedTime === t.id} onClick={() => onTimeSelect(t.id)} />
            ))}
          </div>
        </div>

        {error && (
          <p className="hf-mono" style={{ fontSize: 12, color: "var(--hf-rose)" }}>Error: {error}</p>
        )}

        {/* CTA */}
        <button
          onClick={onSubmit}
          className="hf-btn hf-btn-primary"
          style={{
            fontSize: 18,
            padding: "18px 28px",
            borderRadius: 14,
            fontWeight: 600,
            justifyContent: "center",
            boxShadow: "0 8px 32px var(--hf-violet-glow), inset 0 1px 0 rgba(255,255,255,0.18)",
          }}
        >
          <DiceIcon size={18} /> Deal my next game
          {unplayedCount > 0 && (
            <span className="hf-mono" style={{ fontSize: 12, opacity: 0.7, fontWeight: 400, marginLeft: 4, letterSpacing: "0.05em" }}>
              · {unplayedCount} eligible
            </span>
          )}
        </button>
      </div>

      {/* RIGHT — deck preview */}
      <div className="flex flex-col items-center justify-center relative">
        <DeckStack />
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <div className="hf-mono" style={{ fontSize: 13, color: "var(--hf-fg-muted)", letterSpacing: "0.06em" }}>
            <span style={{ color: "var(--hf-violet-soft)", fontWeight: 600 }}>{unplayedCount} candidates</span> ready to deal
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ SHUFFLING — lively card animation ============ */

function ShufflingState({ unplayedCount, selectedMoods }: { unplayedCount: number; selectedMoods: Mood[] }) {
  const moodLabels = selectedMoods.length > 0 ? selectedMoods.join(" · ") : "any mood";
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 400);
    return () => clearInterval(iv);
  }, []);

  // Cards riffle up and down in a staggered pattern
  const CARD_COUNT = 8;

  return (
    <div className="animate-fade" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
      {/* status text */}
      <div style={{ textAlign: "center", marginBottom: 50, position: "relative", zIndex: 2 }}>
        <div className="hf-mono" style={{ fontSize: 12, color: "var(--hf-violet-soft)", letterSpacing: "0.16em", marginBottom: 10 }}>
          SHUFFLING THE DECK
        </div>
        <h1 style={{ fontSize: 48, fontWeight: 600, letterSpacing: "-0.035em", margin: 0, lineHeight: 1 }}>
          Scoring <span className="hf-italic" style={{ color: "var(--hf-violet-soft)" }}>{unplayedCount} games</span>…
        </h1>
        <div style={{ fontSize: 14, color: "var(--hf-fg-muted)", marginTop: 12 }}>
          filtering by {moodLabels}
        </div>
      </div>

      {/* Animated shuffling deck */}
      <div style={{ position: "relative", width: 300, height: 420 }}>
        {/* ambient glow */}
        <div
          style={{
            position: "absolute",
            inset: "-15%",
            background: "radial-gradient(circle, var(--hf-violet-glow) 0%, transparent 60%)",
            filter: "blur(50px)",
            pointerEvents: "none",
          }}
        />

        {/* Centered dice icon overlay */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 30,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              background: "radial-gradient(circle, var(--hf-violet), rgba(139,92,246,0.5))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "spin 2s linear infinite",
              boxShadow: "0 0 40px var(--hf-violet-glow), 0 0 80px rgba(139,92,246,0.2)",
            }}
          >
            <DiceIcon size={26} color="#fff" />
          </div>
        </div>

        {/* Card stack with shuffle animation */}
        {Array.from({ length: CARD_COUNT }).map((_, i) => {
          const isActive = (tick % CARD_COUNT) === i;
          const wasActive = ((tick - 1 + CARD_COUNT) % CARD_COUNT) === i;
          const baseOffset = (i - CARD_COUNT / 2) * 3;
          const baseRot = (i - CARD_COUNT / 2) * 1.2;

          // Cards pop up and arc over when it's their turn
          const liftY = isActive ? -80 : wasActive ? -20 : 0;
          const liftX = isActive ? (i < CARD_COUNT / 2 ? 40 : -40) : 0;
          const extraRot = isActive ? (i < CARD_COUNT / 2 ? 12 : -12) : 0;
          const scale = isActive ? 1.08 : 1;
          const zIdx = isActive ? 20 : wasActive ? 15 : CARD_COUNT - i;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 200,
                height: 290,
                borderRadius: 14,
                transform: `translate(-50%, -50%) translate(${baseOffset + liftX}px, ${baseOffset * 0.5 + liftY}px) rotate(${baseRot + extraRot}deg) scale(${scale})`,
                transition: "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
                zIndex: zIdx,
                background: "linear-gradient(155deg, var(--hf-surface), var(--hf-surface-elev))",
                backgroundImage: "repeating-linear-gradient(45deg, rgba(139,92,246,0.15) 0 1px, transparent 1px 8px)",
                border: isActive
                  ? "1.5px solid rgba(139,92,246,0.7)"
                  : "1px solid var(--hf-border-soft)",
                boxShadow: isActive
                  ? "0 20px 50px rgba(0,0,0,0.6), 0 0 40px var(--hf-violet-glow)"
                  : "0 8px 24px rgba(0,0,0,0.4)",
              }}
            />

          );
        })}
      </div>

      {/* Progress bar */}
      <div className="flex flex-col items-center gap-3" style={{ marginTop: 50 }}>
        <div style={{ width: 200, height: 3, borderRadius: 999, background: "var(--hf-surface-elev)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              borderRadius: 999,
              background: "linear-gradient(90deg, var(--hf-violet), var(--hf-cyan))",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s linear infinite",
              width: "100%",
            }}
          />
        </div>
        <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-fg-dim)", letterSpacing: "0.08em" }}>
          SCORING · RANKING · PICKING
        </span>
      </div>
    </div>
  );
}

/* ============ REVEALING — card flip transition ============ */

function RevealingState({ rec }: { rec: Rec }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          inset: "-15%",
          background: "radial-gradient(circle, var(--hf-violet-glow) 0%, transparent 60%)",
          filter: "blur(50px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          width: 280,
          height: 400,
          borderRadius: 18,
          padding: 14,
          background: "linear-gradient(180deg, var(--hf-surface), var(--hf-bg))",
          border: "1.5px solid rgba(139,92,246,0.53)",
          boxShadow: "0 0 0 1px rgba(139,92,246,0.27), 0 32px 80px rgba(0,0,0,0.6), 0 0 120px var(--hf-violet-glow)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          animation: "card-reveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) both",
          perspective: 1000,
        }}
      >
        <div className="hf-mono" style={{ fontSize: 10, letterSpacing: "0.16em", color: "var(--hf-violet-soft)", textAlign: "center" }}>
          YOUR PICK
        </div>
        <GameCover name={rec.title} coverUrl={rec.coverUrl} w={252} h={240} radius={12} glow />
        <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.05, textAlign: "center" }}>
          {rec.title}
        </div>
      </div>
    </div>
  );
}

/* ============ REVEAL ============ */

function RevealState({
  rec,
  total,
  onRedraw,
  onReset,
}: {
  rec: Rec;
  total: number;
  onRedraw: () => void;
  onReset: () => void;
}) {
  const matchPct = Math.min(99, Math.max(60, Math.round(rec.score * 10)));

  return (
    <div className="animate-fade" style={{ flex: 1, display: "grid", gridTemplateColumns: "420px 1fr", gap: 56, alignItems: "center", padding: "0 60px", minHeight: 0 }}>
      {/* The card */}
      <div className="flex items-center justify-center relative">
        <div
          style={{
            position: "absolute",
            inset: "-15%",
            background: "radial-gradient(circle, var(--hf-violet-glow) 0%, transparent 60%)",
            filter: "blur(50px)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            width: 360,
            height: 520,
            borderRadius: 18,
            padding: 16,
            background: "linear-gradient(180deg, var(--hf-surface), var(--hf-bg))",
            border: "1.5px solid rgba(139,92,246,0.53)",
            boxShadow: "0 0 0 1px rgba(139,92,246,0.27), 0 32px 80px rgba(0,0,0,0.6), 0 0 120px var(--hf-violet-glow)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            position: "relative",
            transform: "rotate(-2deg)",
          }}
        >
          <div className="flex justify-between items-center">
            <span className="hf-mono" style={{ fontSize: 10, letterSpacing: "0.16em", color: "var(--hf-violet-soft)" }}>
              YOUR PICK
            </span>
            <span
              className="hf-mono"
              style={{
                fontSize: 10,
                color: "var(--hf-violet-soft)",
                padding: "3px 8px",
                background: "var(--hf-violet-bg)",
                borderRadius: 999,
              }}
            >
              {matchPct}% MATCH
            </span>
          </div>
          <GameCover name={rec.title} coverUrl={rec.coverUrl} w={328} h={300} radius={12} glow />
          <div>
            <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.05 }}>
              {rec.title}
            </div>
            <div className="hf-mono" style={{ fontSize: 12, color: "var(--hf-fg-muted)", marginTop: 4 }}>
              {rec.releaseYear && <>{rec.releaseYear} · </>}
              {rec.hltbMainHours && rec.hltbMainHours > 0 && <>~{rec.hltbMainHours.toFixed(0)}h to beat · </>}
              Priority {rec.priority}/5
            </div>
          </div>
          {rec.genres.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {rec.genres.slice(0, 4).map((g) => (
                <span key={g} className="hf-pill">{g}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right — context + actions */}
      <div className="flex flex-col gap-6" style={{ maxWidth: 480 }}>
        <div>
          <div className="hf-cap" style={{ marginBottom: 8, color: "var(--hf-violet-soft)" }}>YOUR READING</div>
          <h1 style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.035em", margin: 0, lineHeight: 1 }}>
            You should play<br />
            <span className="hf-italic" style={{ color: "var(--hf-violet-soft)" }}>{rec.title}.</span>
          </h1>
          <p style={{ fontSize: 15, color: "var(--hf-fg-muted)", marginTop: 14, lineHeight: 1.55 }}>
            {rec.why}
          </p>
        </div>

        {/* Reasons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {rec.hltbMainHours && rec.hltbMainHours > 0 && (
            <ReasonTile label="TIME FIT" value={`~${rec.hltbMainHours.toFixed(0)}h to beat`} color="var(--hf-cyan)" />
          )}
          {rec.genres.length > 0 && (
            <ReasonTile label="GENRE" value={rec.genres.slice(0, 2).join(" · ")} color="var(--hf-emerald)" />
          )}
          <ReasonTile label="PRIORITY" value={`${rec.priority}/5`} color="var(--hf-violet-soft)" />
          <ReasonTile
            label="STATUS"
            value={rec.status === "PAUSED" ? "Paused — pick it back up" : "Unplayed"}
            color="var(--hf-amber)"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2.5" style={{ marginTop: 4 }}>
          <button onClick={onRedraw} className="hf-btn" style={{ padding: "14px 22px", fontSize: 15, fontWeight: 600 }}>
            <DiceIcon size={14} /> Re-draw
          </button>
          <button onClick={onReset} className="hf-btn" style={{ padding: "14px 22px", fontSize: 15 }}>
            Back to setup
          </button>
        </div>

        <div
          className="hf-mono"
          style={{
            fontSize: 12,
            color: "var(--hf-fg-dim)",
            letterSpacing: "0.04em",
            paddingTop: 8,
            borderTop: "1px solid var(--hf-border-soft)",
          }}
        >
          ONE CARD ONLY. NO RUNNERS-UP.{" "}
          <span style={{ color: "var(--hf-violet-soft)" }}>COMMIT OR RE-DRAW.</span>
        </div>
      </div>
    </div>
  );
}

function ReasonTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        padding: "11px 14px",
        borderRadius: 11,
        background: "rgba(255,255,255,0.025)",
        border: "1px solid var(--hf-border-soft)",
      }}
    >
      <div className="hf-mono" style={{ fontSize: 10, letterSpacing: "0.1em", color }}>{label}</div>
      <div style={{ fontSize: 13.5, marginTop: 5, fontWeight: 500, letterSpacing: "-0.005em" }}>{value}</div>
    </div>
  );
}

/* ============ EMPTY ============ */

function EmptyState({ onReset, unplayedCount }: { onReset: () => void; unplayedCount: number }) {
  return (
    <div className="animate-fade" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", textAlign: "center" }}>
      {/* empty deck illustration */}
      <div style={{ position: "relative", width: 320, height: 380, marginBottom: 36 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle, rgba(139,92,246,0.07), transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        {[2, 1, 0].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) translate(${i * 4}px, ${i * 2}px) rotate(${(i - 1) * 2}deg)`,
              width: 220,
              height: 320,
              borderRadius: 14,
              background: "transparent",
              border: "1.5px dashed var(--hf-fg-dim)",
              opacity: 0.4 + i * 0.15,
            }}
          />
        ))}
        <div
          className="hf-mono"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            color: "var(--hf-fg-dim)",
            fontSize: 11,
            letterSpacing: "0.12em",
          }}
        >
          NO CARDS
        </div>
      </div>

      <h1 style={{ fontSize: 38, fontWeight: 600, letterSpacing: "-0.035em", margin: 0, lineHeight: 1 }}>
        The deck is <span className="hf-italic" style={{ color: "var(--hf-violet-soft)" }}>empty</span>.
      </h1>
      <p style={{ fontSize: 15, color: "var(--hf-fg-muted)", marginTop: 14, maxWidth: 440, lineHeight: 1.55 }}>
        No games matched your filters. Try loosening your criteria, or add more games to your backlog.
      </p>

      <div className="flex gap-2.5" style={{ marginTop: 28 }}>
        <button onClick={onReset} className="hf-btn hf-btn-primary" style={{ padding: "14px 22px", fontSize: 15, fontWeight: 600 }}>
          <DiceIcon size={14} /> Try again
        </button>
        <Link href="/backlog" className="hf-btn" style={{ padding: "14px 22px", fontSize: 15 }}>
          + Add games
        </Link>
      </div>

      <div style={{ marginTop: 32, fontSize: 12, color: "var(--hf-fg-dim)" }}>
        0 of {unplayedCount} games matched your filters
      </div>
    </div>
  );
}

/* ============ SHARED COMPONENTS ============ */

function MoodCard({ mood, active, onClick }: { mood: { id: string; label: string; icon: string }; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8,
        padding: "13px 14px",
        borderRadius: 12,
        minWidth: 0,
        background: active ? "var(--hf-violet-bg)" : "rgba(255,255,255,0.025)",
        border: `1px solid ${active ? "rgba(139,92,246,0.65)" : "var(--hf-border-soft)"}`,
        color: active ? "var(--hf-fg)" : "var(--hf-fg-muted)",
        cursor: "pointer",
        boxShadow: active ? "0 0 0 1px rgba(139,92,246,0.3), 0 8px 24px var(--hf-violet-glow)" : "none",
        transition: "all 0.15s",
        textAlign: "left",
      }}
    >
      <span style={{ fontSize: 18, filter: active ? "none" : "grayscale(0.4) opacity(0.7)" }}>{mood.icon}</span>
      <div style={{ fontSize: 13.5, fontWeight: 500, letterSpacing: "-0.01em" }}>{mood.label}</div>
    </button>
  );
}

function TimeBtn({ t, active, onClick }: { t: { id: string; label: string; sub: string }; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 4,
        padding: "11px 14px",
        borderRadius: 11,
        background: active ? "var(--hf-violet)" : "rgba(255,255,255,0.025)",
        border: `1px solid ${active ? "var(--hf-violet)" : "var(--hf-border-soft)"}`,
        color: active ? "#fff" : "var(--hf-fg)",
        cursor: "pointer",
        textAlign: "left",
        boxShadow: active ? "0 0 0 1px rgba(139,92,246,0.65), 0 8px 24px var(--hf-violet-glow)" : "none",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>{t.label}</div>
      <div className="hf-mono" style={{ fontSize: 11, opacity: active ? 0.85 : 0.6 }}>{t.sub}</div>
    </button>
  );
}

function DeckStack() {
  return (
    <div style={{ position: "relative", width: 360, height: 480 }}>
      <div
        style={{
          position: "absolute",
          inset: "-20%",
          background: "radial-gradient(circle, var(--hf-violet-glow) 0%, transparent 60%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
      {[7, 6, 5, 4, 3, 2, 1, 0].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) translate(${(i - 3) * 5}px, ${(i - 3) * 3}px) rotate(${(i - 4) * 1.5}deg)`,
            width: 240,
            height: 340,
            borderRadius: 14,
            background: "linear-gradient(155deg, var(--hf-surface), var(--hf-surface-elev))",
            backgroundImage: "repeating-linear-gradient(45deg, rgba(139,92,246,0.1) 0 1px, transparent 1px 8px)",
            border: "1px solid var(--hf-border-soft)",
            boxShadow: i === 0 ? "0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.2)" : "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {i === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 999,
                  background: "radial-gradient(circle, var(--hf-violet), rgba(139,92,246,0.53))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 32px var(--hf-violet-glow)",
                }}
              >
                <DiceIcon size={26} color="#fff" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
