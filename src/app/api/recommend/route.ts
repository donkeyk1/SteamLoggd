import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { scoreGames, buildGenreAffinity } from "@/lib/recommender/score";
import type { Mood } from "@/lib/recommender/weights";

const RecommendSchema = z.object({
  availableMinutes: z.number().int().min(15).max(600).default(60),
  moods: z
    .array(z.enum(["chill", "intense", "story", "multiplayer", "short-session"]))
    .default([]),
});

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

  const { availableMinutes, moods } = parsed.data;

  const [candidates, ratedGames] = await Promise.all([
    db.userGame.findMany({
      where: {
        userId: session.userId,
        ...(moods.includes("multiplayer") ? {} : { isMultiplayer: false }),
        OR: [
          { status: { in: ["UNPLAYED", "PAUSED"] } },
          { status: "BEAT", wantReplay: true },
        ],
      },
      include: { game: true },
    }),
    // Fetch beat + dropped rated games to build genre affinity
    db.userGame.findMany({
      where: {
        userId: session.userId,
        status: { in: ["BEAT", "DROPPED"] },
        rating: { not: null },
      },
      select: { rating: true, game: { select: { genres: true } } },
    }),
  ]);

  const affinityMap = buildGenreAffinity(ratedGames);
  const scored = scoreGames(candidates, availableMinutes, moods as Mood[], affinityMap);
  const top3 = scored.slice(0, 3).map(({ row, total, why }) => ({
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
