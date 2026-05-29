import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  scoreGames,
  buildGenreAffinity,
  buildCurrentTaste,
  selectPicks,
  type AffinityInput,
} from "@/lib/recommender/score";

const RecommendSchema = z.object({
  // The vibe(s) the user picked — the tone gate.
  vibes: z.array(z.enum(["chill", "intense", "story", "dark", "happy"])).default([]),
  // The genre(s) the user picked — the mechanics gate.
  genres: z
    .array(z.enum(["rpg", "shooter", "action-adventure", "strategy", "platformer", "racing", "simulation", "horror"]))
    .default([]),
  // Whether to include multiplayer games in the candidate pool.
  includeMultiplayer: z.boolean().default(false),
  // How much time they have for today's session (soft signal).
  sessionMinutes: z.number().int().min(15).max(600).default(120),
  // How long a game they want to commit to (length signal).
  desiredLength: z.enum(["quick", "medium", "long", "any"]).default("any"),
  // On a re-draw we jitter the ranking so near-ties reshuffle into a fresh
  // hand while clearly-stronger picks still tend to surface.
  reroll: z.boolean().default(false),
});

// Ordering noise added per candidate on a re-roll. Scores are weighted sums in
// roughly the 0–1 range, so ±0.06 reshuffles games within ~0.12 of each other
// without promoting weak candidates over strong ones.
const REROLL_JITTER = 0.06;
const DIVERSITY_PENALTY = 0.15;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = RecommendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { vibes, genres, includeMultiplayer, sessionMinutes, desiredLength, reroll } = parsed.data;

  const [candidates, opinionGames, playingGames] = await Promise.all([
    db.userGame.findMany({
      where: {
        userId: session.userId,
        ...(includeMultiplayer ? {} : { isMultiplayer: false }),
        OR: [
          { status: { in: ["UNPLAYED", "PAUSED"] } },
          { status: "BEAT", wantReplay: true },
        ],
      },
      include: { game: true },
    }),
    // Games you've formed an opinion on, used to model genre taste from your
    // ratings *and* playtime.
    db.userGame.findMany({
      where: {
        userId: session.userId,
        status: { in: ["BEAT", "DROPPED", "PLAYING", "PAUSED"] },
      },
      select: {
        status: true,
        rating: true,
        steamPlaytimeMinutes: true,
        manualPlaytimeMinutes: true,
        game: { select: { genres: true, hltbMainHours: true } },
      },
    }),
    // What you're playing right now, to bias picks toward your current vibe.
    db.userGame.findMany({
      where: { userId: session.userId, status: "PLAYING" },
      select: { game: { select: { genres: true } } },
    }),
  ]);

  const affinityInput: AffinityInput[] = opinionGames.map((g) => ({
    status: g.status,
    rating: g.rating,
    playtimeMinutes: (g.steamPlaytimeMinutes ?? 0) + (g.manualPlaytimeMinutes ?? 0),
    hltbMainHours: g.game.hltbMainHours,
    genres: g.game.genres,
  }));

  const affinityMap = buildGenreAffinity(affinityInput);
  const currentTaste = buildCurrentTaste(playingGames.map((p) => ({ genres: p.game.genres })));
  const scored = scoreGames(
    candidates,
    { vibes, genres, sessionMinutes, desiredLength },
    affinityMap,
    currentTaste
  );

  // Pick a diverse hand of 3; jitter the ordering on a re-draw so near-ties
  // reshuffle into a fresh hand.
  const picks = selectPicks(scored, 3, {
    jitter: reroll ? REROLL_JITTER : 0,
    diversityPenalty: DIVERSITY_PENALTY,
  });

  const top3 = picks.map(({ row, total, why }) => ({
    userGameId: row.id,
    title: row.game.title,
    coverUrl: row.game.coverUrl,
    genres: row.game.genres,
    releaseYear: row.game.releaseYear,
    hltbMainHours: row.game.hltbMainHours,
    status: row.status,
    priority: row.priority,
    score: Math.round(total * 100) / 100,
    why,
  }));

  return NextResponse.json({ recommendations: top3, total: candidates.length });
}
