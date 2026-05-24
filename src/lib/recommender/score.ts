import type { Game, UserGame } from "@prisma/client";
import { WEIGHTS, MOOD_GENRES, type Mood } from "./weights";

type Row = UserGame & { game: Game };

export type ScoredGame = {
  row: Row;
  total: number;
  why: string;
};

// Build a map of genre → normalised average rating (0–1) from the user's rated BEAT games.
// Genres with no rated games return undefined (treated as neutral 0.5 by callers).
export function buildGenreAffinity(
  ratedGames: Array<{ game: { genres: string[] }; rating: number | null }>
): Map<string, number> {
  const totals = new Map<string, { sum: number; count: number }>();
  for (const { game, rating } of ratedGames) {
    if (!rating) continue;
    for (const genre of game.genres) {
      const prev = totals.get(genre) ?? { sum: 0, count: 0 };
      totals.set(genre, { sum: prev.sum + rating, count: prev.count + 1 });
    }
  }
  const out = new Map<string, number>();
  for (const [genre, { sum, count }] of totals) {
    out.set(genre, sum / count / 5); // normalise: rating 5 → 1.0, rating 1 → 0.2
  }
  return out;
}

function priorityScore(priority: number): number {
  return (priority - 1) / 4; // 1→0.0, 5→1.0
}

function timeFitScore(hltbMainHours: number | null, availableMinutes: number): number {
  if (!hltbMainHours || hltbMainHours <= 0) return 0.5;
  const availableHours = availableMinutes / 60;
  const ratio = availableHours / hltbMainHours;
  if (ratio >= 1.0) return 1.0;  // finishable in one session
  if (ratio >= 0.5) return 0.75; // 2 sessions
  if (ratio >= 0.2) return 0.45; // several sessions
  return 0.2;                    // very long game
}

function moodMatchScore(genres: string[], moods: Mood[]): number {
  const moodsWithGenres = moods.filter((m) => m !== "short-session");
  if (moodsWithGenres.length === 0) return 0.5;

  const genreSet = new Set(moodsWithGenres.flatMap((m) => MOOD_GENRES[m]));
  if (genreSet.size === 0) return 0.5;
  if (genres.length === 0) return 0.3;

  const matched = genres.filter((g) => genreSet.has(g)).length;
  if (matched === 0) return 0.1;
  return Math.min(1.0, (matched / genres.length) * 1.5);
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

function buildWhy(
  row: Row,
  scores: { priority: number; timeFit: number; mood: number; recency: number; affinity: number },
  availableMinutes: number,
  moods: Mood[],
  affinityMap: Map<string, number>
): string {
  const parts: string[] = [];

  if (scores.priority >= 0.75) parts.push("high priority");

  const hltb = row.game.hltbMainHours;
  if (hltb && hltb > 0) {
    if (scores.timeFit >= 0.95) {
      parts.push(`finishable in your ${Math.round(availableMinutes / 60)}h window`);
    } else if (scores.timeFit >= 0.65) {
      parts.push(`~${hltb.toFixed(0)} h to beat`);
    }
  }

  const moodsWithGenres = moods.filter((m) => m !== "short-session");
  if (moodsWithGenres.length > 0 && scores.mood >= 0.4) {
    parts.push(`matches ${moodsWithGenres.slice(0, 2).join("/")} vibe`);
  }

  // Mention genre affinity only when it's a meaningful signal (map has data + score is strong)
  if (affinityMap.size >= 3 && scores.affinity >= 0.72) {
    const likedGenres = row.game.genres.filter((g) => (affinityMap.get(g) ?? 0) >= 0.7);
    if (likedGenres.length > 0) {
      parts.push(`you tend to enjoy ${likedGenres[0]}`);
    }
  }

  if (scores.recency >= 0.85) parts.push("recently added");
  if (row.status === "PAUSED") parts.push("pick up where you left off");

  return parts.length > 0 ? parts.join(" · ") : "Solid pick from your backlog";
}

export function scoreGames(
  rows: Row[],
  availableMinutes: number,
  moods: Mood[],
  affinityMap: Map<string, number>
): ScoredGame[] {
  const shortSession = moods.includes("short-session");
  const wTime = shortSession ? WEIGHTS.timeFit + 0.1 : WEIGHTS.timeFit;
  const wMood = shortSession ? WEIGHTS.moodMatch - 0.05 : WEIGHTS.moodMatch;

  const scored = rows.map((row) => {
    const p = priorityScore(row.priority);
    const t = timeFitScore(row.game.hltbMainHours, availableMinutes);
    const m = moodMatchScore(row.game.genres, moods);
    const r = recencyScore(row.addedAt);
    const a = genreAffinityScore(row.game.genres, affinityMap);
    const paused = row.status === "PAUSED" ? 1 : 0;

    const total =
      WEIGHTS.priority * p +
      wTime * t +
      wMood * m +
      WEIGHTS.recency * r +
      WEIGHTS.genreAffinity * a -
      WEIGHTS.pausedPenalty * paused;

    return {
      row,
      total,
      why: buildWhy(
        row,
        { priority: p, timeFit: t, mood: m, recency: r, affinity: a },
        availableMinutes,
        moods,
        affinityMap
      ),
    };
  });

  return scored.sort((a, b) => b.total - a.total);
}
