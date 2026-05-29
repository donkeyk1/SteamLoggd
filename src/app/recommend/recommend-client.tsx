"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Vibe, Genre, GameLength } from "@/lib/recommender/weights";
import { GameCover } from "@/components/ui/game-cover";
import { DiceIcon, PlayIcon } from "@/components/ui/icons";

// The vibe — tone. Pick the kind of experience you're after.
const VIBES: { id: Vibe; label: string; icon: string }[] = [
  { id: "chill", label: "Chill", icon: "🍃" },
  { id: "intense", label: "Intense", icon: "⚡" },
  { id: "story", label: "Story-rich", icon: "📖" },
  { id: "dark", label: "Dark", icon: "🌑" },
  { id: "happy", label: "Happy", icon: "☀️" },
];

// The genre — mechanics. What kind of game to play.
const GENRES: { id: Genre; label: string }[] = [
  { id: "rpg", label: "RPG" },
  { id: "shooter", label: "Shooter" },
  { id: "action-adventure", label: "Action-Adv." },
  { id: "strategy", label: "Strategy" },
  { id: "platformer", label: "Platformer" },
  { id: "racing", label: "Racing" },
  { id: "simulation", label: "Simulation" },
  { id: "horror", label: "Horror" },
];

// How much time you have for today's session (soft signal).
const SESSIONS = [
  { id: "short", label: "30 min", sub: "quick session", minutes: 30 },
  { id: "med", label: "1–2 hrs", sub: "an evening", minutes: 90 },
  { id: "long", label: "3+ hrs", sub: "a big block", minutes: 240 },
];

// How long a game you want to commit to (length signal).
const LENGTHS: { id: GameLength; label: string; sub: string }[] = [
  { id: "quick", label: "Quick", sub: "< 6h" },
  { id: "medium", label: "Medium", sub: "6–20h" },
  { id: "long", label: "Long", sub: "20h+" },
  { id: "any", label: "Any", sub: "no pref" },
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

type Phase = "setup" | "shuffling" | "reveal" | "empty";

export function RecommendClient({
  baseEligible,
  multiplayerEligible,
}: {
  baseEligible: number;
  multiplayerEligible: number;
}) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedVibes, setSelectedVibes] = useState<Vibe[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<Genre[]>([]);
  const [includeMultiplayer, setIncludeMultiplayer] = useState(false);
  const [sessionId, setSessionId] = useState("med");
  const [gameLength, setGameLength] = useState<GameLength>("any");
  const [results, setResults] = useState<Rec[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function toggleVibe(vibe: Vibe) {
    setSelectedVibes((prev) =>
      prev.includes(vibe) ? prev.filter((v) => v !== vibe) : [...prev, vibe],
    );
  }

  function toggleGenre(genre: Genre) {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  }

  const sessionMinutes = SESSIONS.find((s) => s.id === sessionId)?.minutes ?? 90;
  const eligibleCount = includeMultiplayer ? baseEligible + multiplayerEligible : baseEligible;

  async function submit(isReroll = false) {
    setPhase("shuffling");
    setError(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vibes: selectedVibes,
          genres: selectedGenres,
          includeMultiplayer,
          sessionMinutes,
          desiredLength: gameLength,
          reroll: isReroll,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? res.statusText);
      }
      const data = await res.json();
      setTotal(data.total);

      // Let the shuffle animation breathe — shorter on a re-draw.
      await new Promise((r) => setTimeout(r, isReroll ? 1200 : 2500));

      if (data.recommendations.length === 0) {
        setPhase("empty");
      } else {
        setResults(data.recommendations);
        setSelectedIndex(0);
        setPhase("reveal");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setPhase("setup");
    }
  }

  function reset() {
    setPhase("setup");
    setResults([]);
    setSelectedIndex(0);
    setTotal(0);
  }

  if (phase === "shuffling") return <ShufflingState unplayedCount={eligibleCount} selectedVibes={selectedVibes} />;
  if (phase === "reveal" && results.length > 0) {
    return (
      <RevealState
        results={results}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        total={total}
        onRedraw={() => submit(true)}
        onReset={reset}
      />
    );
  }
  if (phase === "empty") return <EmptyState onReset={reset} unplayedCount={eligibleCount} />;

  return (
    <SetupState
      selectedVibes={selectedVibes}
      selectedGenres={selectedGenres}
      includeMultiplayer={includeMultiplayer}
      sessionId={sessionId}
      gameLength={gameLength}
      unplayedCount={eligibleCount}
      error={error}
      onVibeToggle={toggleVibe}
      onGenreToggle={toggleGenre}
      onMultiplayerToggle={() => setIncludeMultiplayer((v) => !v)}
      onSessionSelect={setSessionId}
      onLengthSelect={setGameLength}
      onSubmit={() => submit(false)}
    />
  );
}

/* ============ SETUP ============ */

function SetupState({
  selectedVibes,
  selectedGenres,
  includeMultiplayer,
  sessionId,
  gameLength,
  unplayedCount,
  error,
  onVibeToggle,
  onGenreToggle,
  onMultiplayerToggle,
  onSessionSelect,
  onLengthSelect,
  onSubmit,
}: {
  selectedVibes: Vibe[];
  selectedGenres: Genre[];
  includeMultiplayer: boolean;
  sessionId: string;
  gameLength: GameLength;
  unplayedCount: number;
  error: string | null;
  onVibeToggle: (vibe: Vibe) => void;
  onGenreToggle: (genre: Genre) => void;
  onMultiplayerToggle: () => void;
  onSessionSelect: (id: string) => void;
  onLengthSelect: (id: GameLength) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="animate-fade" style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 36, flex: 1, minHeight: 0 }}>
      {/* LEFT — controls */}
      <div className="hf-scroll" style={{ display: "flex", flexDirection: "column", gap: 18, paddingTop: 8, overflowY: "auto", paddingRight: 4 }}>
        <div>
          <div className="hf-cap" style={{ marginBottom: 8 }}>STEP 01 · TUNE THE DECK</div>
          <h1 style={{ fontSize: 42, fontWeight: 600, letterSpacing: "-0.035em", margin: 0, lineHeight: 1 }}>
            What should I<br />
            <span className="hf-italic" style={{ color: "var(--hf-violet-soft)" }}>play next?</span>
          </h1>
          <p style={{ fontSize: 14.5, color: "var(--hf-fg-muted)", marginTop: 10, lineHeight: 1.5, maxWidth: 460 }}>
            Pick a vibe and genre, how much time you&apos;ve got today, and how long a game you want to sink into. We&apos;ll deal three — pick one or re-draw.
          </p>
        </div>

        {/* Vibe */}
        <div>
          <div className="flex justify-between items-baseline" style={{ marginBottom: 10 }}>
            <span className="hf-cap">Vibe</span>
            <button
              onClick={onMultiplayerToggle}
              className="btn-press"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11.5,
                padding: "4px 10px",
                borderRadius: 999,
                cursor: "pointer",
                background: includeMultiplayer ? "var(--hf-violet-bg)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${includeMultiplayer ? "rgba(139,92,246,0.6)" : "var(--hf-border-soft)"}`,
                color: includeMultiplayer ? "var(--hf-fg)" : "var(--hf-fg-muted)",
              }}
            >
              <span style={{ fontSize: 13 }}>🎮</span>
              {includeMultiplayer ? "Including multiplayer" : "Include multiplayer"}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 7 }}>
            {VIBES.map((v) => (
              <MoodCard key={v.id} mood={v} active={selectedVibes.includes(v.id)} onClick={() => onVibeToggle(v.id)} />
            ))}
          </div>
        </div>

        {/* Genre */}
        <div>
          <div className="hf-cap" style={{ marginBottom: 10 }}>Genre</div>
          <div className="flex flex-wrap" style={{ gap: 7 }}>
            {GENRES.map((g) => (
              <GenrePill key={g.id} label={g.label} active={selectedGenres.includes(g.id)} onClick={() => onGenreToggle(g.id)} />
            ))}
          </div>
        </div>

        {/* Time today + Game length, side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "3fr 4fr", gap: 18 }}>
          <div>
            <div className="hf-cap" style={{ marginBottom: 10 }}>Time today?</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
              {SESSIONS.map((s) => (
                <TimeBtn key={s.id} t={s} active={sessionId === s.id} onClick={() => onSessionSelect(s.id)} />
              ))}
            </div>
          </div>
          <div>
            <div className="hf-cap" style={{ marginBottom: 10 }}>How long a game?</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7 }}>
              {LENGTHS.map((l) => (
                <TimeBtn key={l.id} t={l} active={gameLength === l.id} onClick={() => onLengthSelect(l.id)} />
              ))}
            </div>
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
          <DiceIcon size={18} /> Deal three games
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

function ShufflingState({ unplayedCount, selectedVibes }: { unplayedCount: number; selectedVibes: Vibe[] }) {
  const moodLabels =
    selectedVibes.length > 0
      ? selectedVibes.map((v) => VIBES.find((x) => x.id === v)?.label ?? v).join(" · ")
      : "any vibe";
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
          SCORING · RANKING · DEALING
        </span>
      </div>
    </div>
  );
}

/* ============ REVEAL — three picks, choose one ============ */

function RevealState({
  results,
  selectedIndex,
  onSelect,
  total,
  onRedraw,
  onReset,
}: {
  results: Rec[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  total: number;
  onRedraw: () => void;
  onReset: () => void;
}) {
  const router = useRouter();
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const sel = results[selectedIndex] ?? results[0];

  async function markPlaying() {
    setMarking(true);
    setMarkError(null);
    try {
      const res = await fetch(`/api/games/${sel.userGameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PLAYING" }),
      });
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setMarkError(
        res.status === 404
          ? "That game isn't in your library anymore — try re-drawing."
          : (data.error ?? "Couldn't update — please try again."),
      );
    } catch {
      setMarkError("Network error — please try again.");
    }
    setMarking(false);
  }

  return (
    <div className="animate-fade" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, paddingTop: 4 }}>
      {/* header */}
      <div className="flex justify-between items-end" style={{ marginBottom: 20 }}>
        <div>
          <div className="hf-cap" style={{ marginBottom: 6, color: "var(--hf-violet-soft)" }}>YOUR HAND · {results.length} DEALT</div>
          <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.035em", margin: 0, lineHeight: 1 }}>
            Pick your <span className="hf-italic" style={{ color: "var(--hf-violet-soft)" }}>next play.</span>
          </h1>
        </div>
        <div className="flex gap-2.5">
          <button onClick={onRedraw} className="hf-btn btn-press" style={{ padding: "12px 18px", fontSize: 14, fontWeight: 600 }}>
            <DiceIcon size={14} /> Re-draw
          </button>
          <button onClick={onReset} className="hf-btn hf-btn-ghost btn-press" style={{ padding: "12px 18px", fontSize: 14 }}>
            Back to setup
          </button>
        </div>
      </div>

      {/* main: cards + detail */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 40, flex: 1, minHeight: 0, alignItems: "start" }}>
        {/* the three dealt cards */}
        <div className="flex gap-3.5">
          {results.map((rec, i) => (
            <PickCard
              key={rec.userGameId}
              rec={rec}
              index={i}
              active={i === selectedIndex}
              onClick={() => onSelect(i)}
            />
          ))}
        </div>

        {/* detail for the selected card */}
        <div className="flex flex-col gap-5" style={{ maxWidth: 460, paddingTop: 6 }}>
          <div>
            <div className="hf-cap" style={{ marginBottom: 8, color: "var(--hf-violet-soft)" }}>WHY THIS ONE</div>
            <h2 style={{ fontSize: 27, fontWeight: 600, letterSpacing: "-0.025em", margin: 0, lineHeight: 1.08 }}>
              {sel.title}
            </h2>
            <p style={{ fontSize: 14.5, color: "var(--hf-fg-muted)", marginTop: 10, lineHeight: 1.55 }}>
              {sel.why}
            </p>
          </div>

          {/* reasons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {sel.hltbMainHours && sel.hltbMainHours > 0 && (
              <ReasonTile label="TIME FIT" value={`~${sel.hltbMainHours.toFixed(0)}h to beat`} color="var(--hf-cyan)" />
            )}
            {sel.genres.length > 0 && (
              <ReasonTile label="GENRE" value={sel.genres.slice(0, 2).join(" · ")} color="var(--hf-emerald)" />
            )}
            <ReasonTile label="PRIORITY" value={`${sel.priority}/5`} color="var(--hf-violet-soft)" />
            <ReasonTile
              label="STATUS"
              value={sel.status === "PAUSED" ? "Paused — pick it back up" : "Unplayed"}
              color="var(--hf-amber)"
            />
          </div>

          {/* actions */}
          <div className="flex gap-2.5" style={{ marginTop: 2 }}>
            <button
              onClick={markPlaying}
              disabled={marking}
              className="hf-btn hf-btn-primary btn-press"
              style={{ padding: "13px 20px", fontSize: 15, fontWeight: 600, opacity: marking ? 0.7 : 1, cursor: marking ? "default" : "pointer" }}
            >
              <PlayIcon size={14} /> {marking ? "Starting…" : "Mark as playing"}
            </button>
            <Link
              href={`/backlog?q=${encodeURIComponent(sel.title)}`}
              className="hf-btn btn-press"
              style={{ padding: "13px 20px", fontSize: 15 }}
            >
              Go to game
            </Link>
          </div>

          {markError && (
            <p className="hf-mono" style={{ fontSize: 12, color: "var(--hf-rose)", marginTop: -8 }}>
              {markError}
            </p>
          )}

          <div
            className="hf-mono"
            style={{
              fontSize: 11.5,
              color: "var(--hf-fg-dim)",
              letterSpacing: "0.04em",
              paddingTop: 8,
              borderTop: "1px solid var(--hf-border-soft)",
            }}
          >
            DEALT {results.length} FROM {total} CANDIDATES ·{" "}
            <span style={{ color: "var(--hf-violet-soft)" }}>RE-DRAW FOR A FRESH HAND.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PickCard({
  rec,
  index,
  active,
  onClick,
}: {
  rec: Rec;
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  // rec.score is the gated quality total (~0–1), so scale by 100 for a percent.
  const matchPct = Math.min(99, Math.max(50, Math.round(rec.score * 100)));

  return (
    <button
      onClick={onClick}
      className="card-hover"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        width: 188,
        padding: 12,
        borderRadius: 16,
        background: active ? "linear-gradient(180deg, var(--hf-surface), var(--hf-bg))" : "rgba(255,255,255,0.02)",
        border: active ? "1.5px solid rgba(139,92,246,0.6)" : "1px solid var(--hf-border-soft)",
        boxShadow: active
          ? "0 0 0 1px rgba(139,92,246,0.25), 0 24px 60px rgba(0,0,0,0.5), 0 0 80px var(--hf-violet-glow)"
          : "0 8px 24px rgba(0,0,0,0.3)",
        cursor: "pointer",
        textAlign: "left",
        transform: active ? "translateY(-4px)" : "none",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        opacity: active ? 1 : 0.82,
      }}
    >
      <div className="flex justify-between items-center">
        <span className="hf-mono" style={{ fontSize: 9.5, letterSpacing: "0.14em", color: active ? "var(--hf-violet-soft)" : "var(--hf-fg-dim)" }}>
          PICK {index + 1}
        </span>
        <span
          className="hf-mono"
          style={{ fontSize: 9.5, color: "var(--hf-violet-soft)", padding: "2px 7px", background: "var(--hf-violet-bg)", borderRadius: 999 }}
        >
          {matchPct}% MATCH
        </span>
      </div>
      <GameCover name={rec.title} coverUrl={rec.coverUrl} w={164} h={219} radius={10} glow={active} />
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          lineHeight: 1.12,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          minHeight: 34,
        }}
      >
        {rec.title}
      </div>
    </button>
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

function GenrePill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="btn-press"
      style={{
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: "-0.01em",
        padding: "8px 14px",
        borderRadius: 10,
        cursor: "pointer",
        background: active ? "var(--hf-violet-bg)" : "rgba(255,255,255,0.025)",
        border: `1px solid ${active ? "rgba(139,92,246,0.65)" : "var(--hf-border-soft)"}`,
        color: active ? "var(--hf-fg)" : "var(--hf-fg-muted)",
        boxShadow: active ? "0 0 0 1px rgba(139,92,246,0.3), 0 6px 18px var(--hf-violet-glow)" : "none",
        transition: "all 0.15s",
      }}
    >
      {label}
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
