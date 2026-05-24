import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  searchGames,
  fetchTimeToBeats,
  type GameSearchResult,
} from "@/lib/igdb/client";

type MatchedTitle = {
  title: string;
  igdb: GameSearchResult | null;
  error?: boolean;
};

const BulkAddSchema = z.object({
  titles: z.array(z.string().trim().min(1).max(200)).min(1).max(30),
  status: z
    .enum(["UNTRIAGED", "UNPLAYED", "PLAYING", "PAUSED", "BEAT", "DROPPED"])
    .default("UNTRIAGED"),
  priority: z.coerce.number().int().min(1).max(5).default(3),
  platform: z.string().max(60).optional(),
});

type ResultRow = {
  title: string;
  status: "added" | "duplicate" | "no_match" | "error";
  matched?: string;
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BulkAddSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { titles, status, priority, platform } = parsed.data;
  const userId = session.userId;
  const isFinished = status === "BEAT" || status === "DROPPED";

  // Dedupe input titles (case-insensitive) so we don't search the same string twice
  const unique = Array.from(
    new Map(titles.map((t) => [t.toLowerCase(), t])).values()
  );

  // IGDB search in parallel (capped to 30 by schema, so fine)
  const matches: MatchedTitle[] = await Promise.all(
    unique.map(async (title): Promise<MatchedTitle> => {
      try {
        const results = await searchGames(title, 1);
        return { title, igdb: results[0] ?? null };
      } catch {
        return { title, igdb: null, error: true };
      }
    })
  );

  // Batch HLTB lookup for everything we matched
  const matchedIgdbIds = matches
    .map((m) => m.igdb?.igdbId)
    .filter((id): id is number => typeof id === "number");
  const hltbMap = matchedIgdbIds.length
    ? await fetchTimeToBeats(matchedIgdbIds).catch(() => new Map<number, number>())
    : new Map<number, number>();

  const results: ResultRow[] = [];
  for (const m of matches) {
    if (m.error) {
      results.push({ title: m.title, status: "error" });
      continue;
    }

    try {
      const game = m.igdb
        ? await db.game.upsert({
            where: { igdbId: m.igdb.igdbId },
            create: {
              igdbId: m.igdb.igdbId,
              title: m.igdb.title,
              coverUrl: m.igdb.coverUrl,
              genres: m.igdb.genres,
              releaseYear: m.igdb.releaseYear,
              hltbMainHours: hltbMap.get(m.igdb.igdbId) ?? null,
            },
            update: {
              title: m.igdb.title,
              ...(m.igdb.coverUrl ? { coverUrl: m.igdb.coverUrl } : {}),
              ...(m.igdb.genres.length ? { genres: m.igdb.genres } : {}),
              ...(m.igdb.releaseYear ? { releaseYear: m.igdb.releaseYear } : {}),
              ...(hltbMap.get(m.igdb.igdbId)
                ? { hltbMainHours: hltbMap.get(m.igdb.igdbId) }
                : {}),
            },
          })
        : await db.game.create({ data: { title: m.title, genres: [] } });

      await db.userGame.create({
        data: {
          userId,
          gameId: game.id,
          source: "MANUAL",
          platform: platform ?? null,
          status,
          priority,
          ...(isFinished ? { finishedAt: new Date() } : {}),
        },
      });

      results.push({
        title: m.title,
        status: m.igdb ? "added" : "no_match",
        matched: m.igdb?.title,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        results.push({ title: m.title, status: "duplicate" });
      } else {
        console.error(`[bulk-add] failed for ${m.title}:`, err);
        results.push({ title: m.title, status: "error" });
      }
    }
  }

  return NextResponse.json({ results });
}
