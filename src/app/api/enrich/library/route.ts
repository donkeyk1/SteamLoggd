import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  fetchTimeToBeats,
  lookupBySteamAppIds,
  type GameSearchResult,
} from "@/lib/igdb/client";

/**
 * Attach IGDB metadata to a Game row. If another Game already owns the IGDB id
 * (e.g. the user has both "Battlefield 6" and its Open Beta — both Steam IDs
 * map to the same IGDB game), merge this Game into the canonical one:
 * reparent UserGames, dedupe per-user, delete the orphan.
 */
async function attachIgdb(
  gameId: string,
  igdb: GameSearchResult
): Promise<"updated" | "merged" | "skipped"> {
  try {
    await db.game.update({
      where: { id: gameId },
      data: {
        igdbId: igdb.igdbId,
        ...(igdb.coverUrl ? { coverUrl: igdb.coverUrl } : {}),
        ...(igdb.genres.length ? { genres: igdb.genres } : {}),
        ...(igdb.releaseYear ? { releaseYear: igdb.releaseYear } : {}),
      },
    });
    return "updated";
  } catch (err) {
    if (
      !(err instanceof Prisma.PrismaClientKnownRequestError) ||
      err.code !== "P2002"
    ) {
      throw err;
    }

    const canonical = await db.game.findUnique({
      where: { igdbId: igdb.igdbId },
    });
    if (!canonical || canonical.id === gameId) return "skipped";

    const dupes = await db.userGame.findMany({ where: { gameId } });
    for (const ug of dupes) {
      const collision = await db.userGame.findUnique({
        where: { userId_gameId: { userId: ug.userId, gameId: canonical.id } },
      });
      if (collision) {
        // User already has the canonical version. Keep whichever has more
        // playtime; drop the other.
        const oldPlay = ug.steamPlaytimeMinutes ?? 0;
        const newPlay = collision.steamPlaytimeMinutes ?? 0;
        if (oldPlay > newPlay) {
          await db.userGame.delete({ where: { id: collision.id } });
          await db.userGame.update({
            where: { id: ug.id },
            data: { gameId: canonical.id },
          });
        } else {
          await db.userGame.delete({ where: { id: ug.id } });
        }
      } else {
        await db.userGame.update({
          where: { id: ug.id },
          data: { gameId: canonical.id },
        });
      }
    }
    await db.game.delete({ where: { id: gameId } });
    return "merged";
  }
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  // ── Step 1: IGDB metadata for Steam games we haven't matched yet
  const igdbCandidates = await db.game.findMany({
    where: {
      steamAppId: { not: null },
      igdbId: null,
      userGames: { some: { userId: session.userId } },
    },
    select: { id: true, steamAppId: true },
  });

  let igdbEnriched = 0;
  let igdbMerged = 0;
  if (igdbCandidates.length > 0) {
    const steamIds = igdbCandidates
      .map((g) => g.steamAppId!)
      .filter((id): id is number => id != null);
    const lookups = await lookupBySteamAppIds(steamIds);
    const bySteamId = new Map(igdbCandidates.map((g) => [g.steamAppId!, g.id]));
    for (const [steamAppId, igdb] of lookups) {
      const gameId = bySteamId.get(steamAppId);
      if (!gameId) continue;
      try {
        const result = await attachIgdb(gameId, igdb);
        if (result === "updated") igdbEnriched++;
        else if (result === "merged") igdbMerged++;
      } catch (err) {
        console.error(`[enrich] failed to attach IGDB to ${gameId}:`, err);
      }
    }
  }

  // ── Step 2: time-to-beat for games we now have an IGDB id for
  const ttbCandidates = await db.game.findMany({
    where: {
      igdbId: { not: null },
      hltbMainHours: null,
      userGames: { some: { userId: session.userId } },
    },
    select: { id: true, igdbId: true },
  });

  let ttbEnriched = 0;
  let ttbNotFound = 0;
  if (ttbCandidates.length > 0) {
    const igdbIds = ttbCandidates
      .map((g) => g.igdbId!)
      .filter((id): id is number => id != null);
    const hours = await fetchTimeToBeats(igdbIds);

    const byIgdbId = new Map(ttbCandidates.map((g) => [g.igdbId!, g.id]));
    for (const [igdbId, h] of hours) {
      const gameId = byIgdbId.get(igdbId);
      if (!gameId) continue;
      await db.game.update({
        where: { id: gameId },
        data: { hltbMainHours: h },
      });
      ttbEnriched++;
    }
    const missingIgdbIds = igdbIds.filter((id) => !hours.has(id));
    if (missingIgdbIds.length > 0) {
      await db.game.updateMany({
        where: { igdbId: { in: missingIgdbIds } },
        data: { hltbMainHours: -1 },
      });
      ttbNotFound = missingIgdbIds.length;
    }
  }

  // Remove Steam games that IGDB has no record of (demos, betas, soundtracks, etc.)
  const { count: pruned } = await db.userGame.deleteMany({
    where: {
      userId: session.userId,
      source: "STEAM",
      game: { igdbId: null },
    },
  });
  // Clean up orphaned Game rows no longer referenced by any user
  await db.game.deleteMany({
    where: { igdbId: null, steamAppId: { not: null }, userGames: { none: {} } },
  });

  return NextResponse.json({
    igdbEnriched,
    igdbMerged,
    igdbCandidates: igdbCandidates.length,
    ttbEnriched,
    ttbNotFound,
    ttbCandidates: ttbCandidates.length,
    pruned,
  });
}
