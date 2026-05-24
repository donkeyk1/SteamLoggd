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
  // Per-game overrides (only set on the games path); fall back to batch values
  statusOverride?: z.infer<typeof StatusEnum>;
  priorityOverride?: number;
  platformOverride?: string | null;
};

const StatusEnum = z.enum([
  "WISHLIST",
  "UNTRIAGED",
  "UNPLAYED",
  "PLAYING",
  "PAUSED",
  "BEAT",
  "DROPPED",
]);

const ResolvedGameSchema = z.object({
  igdbId: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  coverUrl: z.string().url().max(500).optional(),
  genres: z.array(z.string().max(60)).max(20).default([]),
  releaseYear: z.number().int().min(1950).max(2100).optional(),
  // Per-game overrides — optional so older callers / titles-path still work
  status: StatusEnum.optional(),
  priority: z.coerce.number().int().min(1).max(5).optional(),
  platform: z.string().max(60).nullable().optional(),
});

// Accepts either:
//   - `titles`: free-text list; we search IGDB for each (fuzzy matching, may miss)
//   - `games`:  pre-resolved IGDB picks from the autocomplete UI (no IGDB search needed,
//               so no per-game rate-limit risk and exact matches guaranteed)
const BulkAddSchema = z
  .object({
    titles: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
    games: z.array(ResolvedGameSchema).max(30).optional(),
    // Batch defaults — applied to all titles path entries, and as fallback for
    // games path entries that don't specify their own values.
    status: StatusEnum.default("UNTRIAGED"),
    priority: z.coerce.number().int().min(1).max(5).default(3),
    platform: z.string().max(60).optional(),
  })
  .refine(
    (d) => (d.titles?.length ?? 0) > 0 || (d.games?.length ?? 0) > 0,
    { message: "must provide titles or games" }
  );

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

  const { titles, games, status, priority, platform } = parsed.data;
  const userId = session.userId;

  // Build the `matches` list. Either path produces the same shape.
  let matches: MatchedTitle[];
  if (games && games.length > 0) {
    // Pre-resolved — dedupe by igdbId; carry per-game overrides through
    const seen = new Set<number>();
    matches = [];
    for (const g of games) {
      if (seen.has(g.igdbId)) continue;
      seen.add(g.igdbId);
      matches.push({
        title: g.title,
        igdb: {
          igdbId: g.igdbId,
          title: g.title,
          coverUrl: g.coverUrl,
          genres: g.genres,
          releaseYear: g.releaseYear,
        },
        statusOverride: g.status,
        priorityOverride: g.priority,
        platformOverride: g.platform === undefined ? undefined : g.platform,
      });
    }
  } else {
    // Title-based — dedupe case-insensitively, then search IGDB in parallel
    const unique = Array.from(
      new Map((titles ?? []).map((t) => [t.toLowerCase(), t])).values()
    );
    matches = await Promise.all(
      unique.map(async (title): Promise<MatchedTitle> => {
        try {
          const results = await searchGames(title, 1);
          return { title, igdb: results[0] ?? null };
        } catch {
          return { title, igdb: null, error: true };
        }
      })
    );
  }

  // Single batched HLTB lookup for every match we have an IGDB id for.
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

      const effectiveStatus = m.statusOverride ?? status;
      const effectivePriority = m.priorityOverride ?? priority;
      const effectivePlatform =
        m.platformOverride !== undefined ? m.platformOverride : platform ?? null;
      const isFinished = effectiveStatus === "BEAT" || effectiveStatus === "DROPPED";

      await db.userGame.create({
        data: {
          userId,
          gameId: game.id,
          source: "MANUAL",
          platform: effectivePlatform,
          status: effectiveStatus,
          priority: effectivePriority,
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
