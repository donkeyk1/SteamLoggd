import type { Game, GameStatus, UserGame } from "@prisma/client";
import {
  WEIGHTS,
  VIBE_TAGS,
  GENRE_TAGS,
  GATE_FLOOR,
  VIBES,
  GENRES,
  type Vibe,
  type Genre,
  type GameLength,
} from "./weights";

type Row = UserGame & { game: Game };

export type ScoredGame = {
  row: Row;
  total: number;
  why: string;
};

// What the user asked for: a vibe/tone (gate), a genre/mechanics (gate), how
// much time they have today (session, soft), and how long a game they want to
// commit to (length).
export type RecOptions = {
  vibes: Vibe[];
  genres: Genre[];
  sessionMinutes: number;
  desiredLength: GameLength;
};

/* ============ Genre affinity (taste model) ============ */

// One played game's worth of evidence for the taste model. Sourced from games
// the user has formed an opinion on: BEAT / DROPPED / PLAYING / PAUSED.
export type AffinityInput = {
  status: GameStatus;
  rating: number | null;
  playtimeMinutes: number;
  hltbMainHours: number | null;
  genres: string[];
};

const AFFINITY_PRIOR = 0.5; // neutral liking
const AFFINITY_PSEUDOCOUNT = 2; // shrink thin-evidence genres toward neutral

// Turn one played game into a (like, weight) opinion, or null if it carries no
// signal. `like` is in [0,1] (0.5 = neutral); `weight` is the confidence.
function opinionFor(g: AffinityInput): { like: number; weight: number } | null {
  // Explicit rating is the strongest, most direct signal.
  if (g.rating != null) {
    return { like: g.rating / 5, weight: 1.5 };
  }

  const hours = g.playtimeMinutes / 60;
  const ratio = g.hltbMainHours && g.hltbMainHours > 0 ? hours / g.hltbMainHours : null;

  if (g.status === "BEAT") {
    // Finished it without rating — a mild positive.
    return { like: 0.72, weight: 0.7 };
  }
  if (g.status === "DROPPED") {
    // Bailing early (little playtime vs length) is a stronger dislike than
    // dropping something late.
    const like = ratio != null && ratio < 0.25 ? 0.2 : 0.4;
    return { like, weight: 0.8 };
  }
  // In-progress (PLAYING / PAUSED): only an opinion once there's real playtime,
  // and only when we know the length to judge "sticking with it".
  if (hours >= 2 && ratio != null) {
    const like = Math.min(1, 0.5 + ratio * 0.5);
    return { like, weight: 0.4 };
  }
  return null;
}

// Build a map of genre → liking (0–1), confidence-weighted across ratings and
// playtime. Genres with little evidence are pulled toward neutral (0.5) so a
// single data point can't dominate. Genres with no evidence are absent (callers
// treat absent as neutral).
export function buildGenreAffinity(games: AffinityInput[]): Map<string, number> {
  const acc = new Map<string, { sum: number; weight: number }>();
  for (const g of games) {
    const op = opinionFor(g);
    if (!op) continue;
    for (const genre of g.genres) {
      const prev = acc.get(genre) ?? { sum: 0, weight: 0 };
      acc.set(genre, {
        sum: prev.sum + op.like * op.weight,
        weight: prev.weight + op.weight,
      });
    }
  }
  const out = new Map<string, number>();
  for (const [genre, { sum, weight }] of acc) {
    out.set(
      genre,
      (sum + AFFINITY_PSEUDOCOUNT * AFFINITY_PRIOR) / (weight + AFFINITY_PSEUDOCOUNT)
    );
  }
  return out;
}

/* ============ Current-play context ============ */

// Genre frequencies among the games you're playing right now, normalised to
// [0,1] (the most common current genre = 1).
export function buildCurrentTaste(
  playingGames: Array<{ genres: string[] }>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const g of playingGames) {
    for (const genre of g.genres) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  if (counts.size === 0) return counts;
  const max = Math.max(...counts.values());
  const out = new Map<string, number>();
  for (const [genre, n] of counts) out.set(genre, n / max);
  return out;
}

// Pure bonus for sharing genres with what you're currently playing: 0.5 (no
// overlap, neutral) up to 1.0 (matches your strongest current genre). Never a
// penalty, so variety isn't punished.
function currentContextScore(genres: string[], taste: Map<string, number>): number {
  if (taste.size === 0 || genres.length === 0) return 0.5;
  const best = Math.max(0, ...genres.map((g) => taste.get(g) ?? 0));
  return 0.5 + 0.5 * best;
}

/* ============ Per-axis scores ============ */

function priorityScore(priority: number): number {
  return (priority - 1) / 4; // 1→0.0, 5→1.0
}

// How well a game's total length matches the length the user wants to commit
// to. This is about the GAME, independent of how much time they have today.
//   bands: quick <6h · medium 6–20h · long 20h+
function lengthFitScore(hltbMainHours: number | null, desired: GameLength): number {
  if (desired === "any" || !hltbMainHours || hltbMainHours <= 0) return 0.5;
  const band = hltbMainHours < 6 ? 0 : hltbMainHours <= 20 ? 1 : 2;
  const target = desired === "quick" ? 0 : desired === "medium" ? 1 : 2;
  const dist = Math.abs(band - target);
  return dist === 0 ? 1.0 : dist === 1 ? 0.5 : 0.15;
}

// A SOFT bonus for fitting today's session — it only ever adds, never penalises,
// so starting a 50h game with 30 minutes today is still fine. Rewards games you
// could finish in one sitting, and resuming a paused game when time is short.
function sessionFitScore(
  hltbMainHours: number | null,
  sessionMinutes: number,
  status: GameStatus
): number {
  const sessionHours = sessionMinutes / 60;
  let s = 0.5; // neutral baseline — most games neither helped nor hurt
  if (status === "PAUSED" && sessionHours <= 1.5) s = 0.85; // easy to jump back in
  if (hltbMainHours && hltbMainHours > 0 && hltbMainHours <= sessionHours) s = 1.0; // finishable today
  return s;
}

// Fit of a game's tag bag (genres + themes) against one include/exclude spec.
//   • an excluded tag is a hard tonal conflict → 0 (e.g. Horror kills "chill")
//   • no tags at all → 0.25 (unknown, can't confirm)
//   • no include match → 0.05 (clearly off)
//   • 1 match → 0.85 · 2+ → 1.0
function specFit(tags: string[], spec: { include: string[]; exclude: string[] }): number {
  if (spec.exclude.length > 0 && tags.some((t) => spec.exclude.includes(t))) return 0;
  if (tags.length === 0) return 0.25;
  const matched = tags.filter((t) => spec.include.includes(t)).length;
  if (matched === 0) return 0.05;
  return matched >= 2 ? 1.0 : 0.85;
}

// Average fit across the selected specs, so "chill + story" requires fitting
// both. Returns 0.5 (neutral) when nothing is selected, making the gate a no-op.
function multiSpecFit(
  tags: string[],
  specs: { include: string[]; exclude: string[] }[]
): number {
  if (specs.length === 0) return 0.5;
  return specs.reduce((sum, spec) => sum + specFit(tags, spec), 0) / specs.length;
}

// A multiplicative gate in [GATE_FLOOR, 1]: a perfect fit keeps full quality, a
// total miss keeps only GATE_FLOOR of it. No selection → 1 (no-op).
function gateFor(fit: number, active: boolean): number {
  return active ? GATE_FLOOR + (1 - GATE_FLOOR) * fit : 1;
}

function genreAffinityScore(genres: string[], affinityMap: Map<string, number>): number {
  if (affinityMap.size === 0 || genres.length === 0) return 0.5; // neutral — no data yet
  const known = genres.map((g) => affinityMap.get(g)).filter((s): s is number => s !== undefined);
  if (known.length === 0) return 0.5; // none of this game's genres have been rated
  return known.reduce((a, b) => a + b, 0) / known.length;
}

function recencyScore(addedAt: Date): number {
  const daysSince = (Date.now() - addedAt.getTime()) / 86_400_000;
  return Math.max(0, 1 - daysSince / 180); // full score today, fades to zero at 6 months
}

const VIBE_LABELS: Record<Vibe, string> = {
  chill: "chill", intense: "intense", story: "story-rich", dark: "dark", happy: "happy",
};
const GENRE_LABELS: Record<Genre, string> = {
  rpg: "RPG", shooter: "shooter", "action-adventure": "action-adventure",
  strategy: "strategy", platformer: "platformer", racing: "racing",
  simulation: "simulation", horror: "horror",
};

function buildWhy(
  row: Row,
  scores: { priority: number; lengthFit: number; sessionFit: number; vibe: number; genre: number; recency: number; affinity: number; context: number },
  opts: RecOptions,
  affinityMap: Map<string, number>,
  hasCurrentTaste: boolean
): string {
  const parts: string[] = [];

  // Lead with the vibe/genre match — they're the lenses the user chose.
  if (opts.vibes.length > 0 && scores.vibe >= 0.5) {
    parts.push(`fits your ${opts.vibes.map((v) => VIBE_LABELS[v]).slice(0, 2).join(" + ")} vibe`);
  }
  if (opts.genres.length > 0 && scores.genre >= 0.5) {
    parts.push(`a ${opts.genres.map((g) => GENRE_LABELS[g]).slice(0, 2).join(" / ")}`);
  }

  const hltb = row.game.hltbMainHours;
  // Length: confirm it matches the commitment the user asked for.
  if (hltb && hltb > 0 && opts.desiredLength !== "any" && scores.lengthFit >= 1.0) {
    parts.push(`~${hltb.toFixed(0)}h — the ${opts.desiredLength} length you wanted`);
  } else if (hltb && hltb > 0) {
    parts.push(`~${hltb.toFixed(0)}h to beat`);
  }

  // Session: only call it out when it genuinely fits today.
  if (hltb && hltb > 0 && hltb <= opts.sessionMinutes / 60) {
    parts.push("could finish it in today's session");
  } else if (row.status === "PAUSED" && opts.sessionMinutes / 60 <= 1.5) {
    parts.push("easy to jump back into");
  }

  if (scores.priority >= 0.75) parts.push("high priority");

  // In the vein of what you're currently playing.
  if (hasCurrentTaste && scores.context >= 0.85) {
    parts.push("in the vein of what you're playing");
  }

  // Mention genre affinity only when it's a meaningful signal (map has data + score is strong)
  if (affinityMap.size >= 3 && scores.affinity >= 0.72) {
    const likedGenres = row.game.genres.filter((g) => (affinityMap.get(g) ?? 0) >= 0.7);
    if (likedGenres.length > 0) {
      parts.push(`you tend to enjoy ${likedGenres[0]}`);
    }
  }

  if (scores.recency >= 0.85) parts.push("recently added");

  return parts.length > 0 ? parts.join(" · ") : "Solid pick from your backlog";
}

export function scoreGames(
  rows: Row[],
  opts: RecOptions,
  affinityMap: Map<string, number>,
  currentTaste: Map<string, number> = new Map()
): ScoredGame[] {
  // Guard against unknown values slipping in from the request.
  const vibes = opts.vibes.filter((v): v is Vibe => (VIBES as readonly string[]).includes(v));
  const genres = opts.genres.filter((g): g is Genre => (GENRES as readonly string[]).includes(g));
  const hasVibe = vibes.length > 0;
  const hasGenre = genres.length > 0;
  const hasCurrentTaste = currentTaste.size > 0;

  // Vibe is scored over genres + themes (tone); genre over genres alone.
  const vibeSpecs = vibes.map((v) => VIBE_TAGS[v]);
  const genreSpecs = genres.map((g) => ({ include: GENRE_TAGS[g], exclude: [] as string[] }));

  const scored = rows.map((row) => {
    const tags = [...row.game.genres, ...row.game.themes];
    const p = priorityScore(row.priority);
    const lf = lengthFitScore(row.game.hltbMainHours, opts.desiredLength);
    const sf = sessionFitScore(row.game.hltbMainHours, opts.sessionMinutes, row.status);
    const r = recencyScore(row.addedAt);
    const a = genreAffinityScore(row.game.genres, affinityMap);
    const c = currentContextScore(row.game.genres, currentTaste);
    const paused = row.status === "PAUSED" ? 1 : 0;

    // "Quality": how good a pick this is regardless of vibe/genre.
    const quality =
      WEIGHTS.priority * p +
      WEIGHTS.lengthFit * lf +
      WEIGHTS.sessionFit * sf +
      WEIGHTS.genreAffinity * a +
      WEIGHTS.currentContext * c +
      WEIGHTS.recency * r -
      WEIGHTS.pausedPenalty * paused;

    // Vibe (tone) and genre (mechanics) are multiplicative GATES: a game that
    // doesn't fit keeps only a fraction of its quality, so it can't outrank a
    // fitting game on length/priority alone. Both AND together.
    const vibeFit = multiSpecFit(tags, vibeSpecs);
    const genreFit = multiSpecFit(tags, genreSpecs);
    const total = quality * gateFor(vibeFit, hasVibe) * gateFor(genreFit, hasGenre);

    return {
      row,
      total,
      why: buildWhy(
        row,
        { priority: p, lengthFit: lf, sessionFit: sf, vibe: vibeFit, genre: genreFit, recency: r, affinity: a, context: c },
        opts,
        affinityMap,
        hasCurrentTaste
      ),
    };
  });

  return scored.sort((a, b) => b.total - a.total);
}

/* ============ Pick selection (diversity + re-roll jitter) ============ */

// Greedily choose `count` picks from a scored list, lightly penalising
// candidates that share a genre with an already-chosen pick so the hand isn't
// three near-identical games. `jitter` adds ordering noise (used on a re-draw)
// so near-ties reshuffle into a fresh hand.
export function selectPicks(
  scored: ScoredGame[],
  count: number,
  opts: { jitter?: number; diversityPenalty?: number } = {}
): ScoredGame[] {
  const jitter = opts.jitter ?? 0;
  const diversityPenalty = opts.diversityPenalty ?? 0.15;

  const pool = scored.map((s) => ({
    s,
    base: s.total + (jitter ? (Math.random() - 0.5) * 2 * jitter : 0),
  }));

  const picked: ScoredGame[] = [];
  const usedGenres = new Set<string>();

  while (picked.length < count && pool.length > 0) {
    let bestIdx = 0;
    let bestVal = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const overlaps = pool[i].s.row.game.genres.some((g) => usedGenres.has(g));
      const val = pool[i].base - (overlaps ? diversityPenalty : 0);
      if (val > bestVal) {
        bestVal = val;
        bestIdx = i;
      }
    }
    const [chosen] = pool.splice(bestIdx, 1);
    picked.push(chosen.s);
    for (const g of chosen.s.row.game.genres) usedGenres.add(g);
  }

  return picked;
}
