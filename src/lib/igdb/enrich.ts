import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  lookupBySteamAppIds,
  fetchTimeToBeats,
  fetchGamesByIgdbIds,
  searchOneByName,
  type GameSearchResult,
} from "@/lib/igdb/client";

// Title-matching is one IGDB request per game (no batch endpoint like Steam's),
// so bound the work per pass and throttle to respect IGDB's ~4 req/s limit.
// Unmatched games remain for the next sync.
const TITLE_MATCH_LIMIT = 20;
const TITLE_MATCH_DELAY_MS = 280;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type EnrichResult = {
  igdbEnriched: number;
  titleMatched: number;
  titleMatchRemaining: number;
  themesBackfilled: number;
  ttbEnriched: number;
  dropped: string[];
};

/**
 * Attach IGDB metadata to a Game row. If another Game already owns the IGDB id
 * (e.g. a game and its Open Beta both map to the same IGDB game), merge this
 * Game into the canonical one: reparent UserGames, dedupe per-user (keeping the
 * higher-playtime row), delete the orphan.
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
        ...(igdb.themes.length ? { themes: igdb.themes } : {}),
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
    const canonical = await db.game.findUnique({ where: { igdbId: igdb.igdbId } });
    if (!canonical || canonical.id === gameId) return "skipped";

    // Capture the orphan's store ids before we delete it, so the canonical can
    // absorb them (below) and future syncs upsert into the canonical row.
    const orphan = await db.game.findUnique({
      where: { id: gameId },
      select: { steamAppId: true, xboxTitleId: true },
    });

    const dupes = await db.userGame.findMany({ where: { gameId } });
    for (const ug of dupes) {
      const collision = await db.userGame.findUnique({
        where: { userId_gameId: { userId: ug.userId, gameId: canonical.id } },
      });
      if (collision) {
        const oldPlay = ug.steamPlaytimeMinutes ?? 0;
        const newPlay = collision.steamPlaytimeMinutes ?? 0;
        if (oldPlay > newPlay) {
          await db.userGame.delete({ where: { id: collision.id } });
          await db.userGame.update({ where: { id: ug.id }, data: { gameId: canonical.id } });
        } else {
          await db.userGame.delete({ where: { id: ug.id } });
        }
      } else {
        await db.userGame.update({ where: { id: ug.id }, data: { gameId: canonical.id } });
      }
    }
    await db.game.delete({ where: { id: gameId } });

    // Absorb the orphan's store ids (now freed by the delete) so the canonical
    // row owns them. Without this, the next Steam/Xbox sync re-creates the
    // orphan from its store id and re-merges it every time — wasted work, and
    // it would burn a throttled title-match slot each sync for Xbox overlaps.
    const transfer: { steamAppId?: number; xboxTitleId?: string } = {};
    if (orphan?.steamAppId != null && canonical.steamAppId == null) {
      transfer.steamAppId = orphan.steamAppId;
    }
    if (orphan?.xboxTitleId != null && canonical.xboxTitleId == null) {
      transfer.xboxTitleId = orphan.xboxTitleId;
    }
    if (Object.keys(transfer).length > 0) {
      await db.game.update({ where: { id: canonical.id }, data: transfer });
    }
    return "merged";
  }
}

/**
 * Enrich a user's library against IGDB: match unmatched Steam games, backfill
 * themes, fetch time-to-beat, and drop unmatched Steam games that IGDB has no
 * record of (demos, betas, soundtracks). Shared by the Steam sync and the
 * standalone enrich endpoint.
 *
 * Games the user has actually touched (status moved off UNTRIAGED, or rated, or
 * with notes) are NEVER dropped even if unmatched — only untouched junk is
 * pruned. `dropped` lists the titles removed so the UI can surface them.
 */
export async function enrichUserLibrary(userId: string): Promise<EnrichResult> {
  // ── Step 1: IGDB metadata for Steam games we haven't matched yet ──────────
  const igdbCandidates = await db.game.findMany({
    where: { steamAppId: { not: null }, igdbId: null, userGames: { some: { userId } } },
    select: { id: true, steamAppId: true },
  });

  let igdbEnriched = 0;
  if (igdbCandidates.length > 0) {
    const steamIds = igdbCandidates.map((g) => g.steamAppId!).filter((id): id is number => id != null);
    const lookups = await lookupBySteamAppIds(steamIds);
    const bySteamId = new Map(igdbCandidates.map((g) => [g.steamAppId!, g.id]));
    for (const [steamAppId, igdb] of lookups) {
      const gameId = bySteamId.get(steamAppId);
      if (!gameId) continue;
      try {
        const result = await attachIgdb(gameId, igdb);
        if (result === "updated" || result === "merged") igdbEnriched++;
      } catch (err) {
        console.error(`[enrich] IGDB attach failed for ${gameId}:`, err);
      }
    }
  }

  // ── Step 1a2: match non-Steam games (Xbox, etc.) by title ─────────────────
  // These have no store-id mapping, so they're matched one IGDB search at a
  // time. Bounded per pass; the count of leftovers is returned so the caller
  // can tell the user to sync again.
  const titleCandidates = await db.game.findMany({
    where: {
      igdbId: null,
      steamAppId: null,
      xboxTitleId: { not: null },
      userGames: { some: { userId } },
    },
    select: { id: true, title: true },
  });

  let titleMatched = 0;
  const titleBatch = titleCandidates.slice(0, TITLE_MATCH_LIMIT);
  for (const g of titleBatch) {
    const igdb = await searchOneByName(g.title).catch(() => null);
    if (igdb) {
      try {
        const result = await attachIgdb(g.id, igdb);
        if (result === "updated" || result === "merged") titleMatched++;
      } catch (err) {
        console.error(`[enrich] title attach failed for ${g.id}:`, err);
      }
    }
    await sleep(TITLE_MATCH_DELAY_MS);
  }
  const titleMatchRemaining = Math.max(0, titleCandidates.length - titleBatch.length);

  // ── Step 1b: backfill themes on games matched before we fetched themes ────
  const themeCandidates = await db.game.findMany({
    where: { igdbId: { not: null }, themes: { isEmpty: true }, userGames: { some: { userId } } },
    select: { id: true, igdbId: true },
  });

  let themesBackfilled = 0;
  if (themeCandidates.length > 0) {
    const igdbIds = themeCandidates.map((g) => g.igdbId!).filter((id): id is number => id != null);
    const lookups = await fetchGamesByIgdbIds(igdbIds);
    const byIgdbId = new Map(themeCandidates.map((g) => [g.igdbId!, g.id]));
    for (const [igdbId, igdb] of lookups) {
      const gameId = byIgdbId.get(igdbId);
      if (!gameId) continue;
      if (!igdb.themes.length && !igdb.genres.length) continue;
      await db.game.update({
        where: { id: gameId },
        data: {
          ...(igdb.themes.length ? { themes: igdb.themes } : {}),
          ...(igdb.genres.length ? { genres: igdb.genres } : {}),
        },
      });
      themesBackfilled++;
    }
  }

  // ── Step 2: time-to-beat for games we now have an IGDB id for ─────────────
  const ttbCandidates = await db.game.findMany({
    where: { igdbId: { not: null }, hltbMainHours: null, userGames: { some: { userId } } },
    select: { id: true, igdbId: true },
  });

  let ttbEnriched = 0;
  if (ttbCandidates.length > 0) {
    const igdbIds = ttbCandidates.map((g) => g.igdbId!).filter((id): id is number => id != null);
    const hours = await fetchTimeToBeats(igdbIds);
    const byIgdbId = new Map(ttbCandidates.map((g) => [g.igdbId!, g.id]));
    for (const [igdbId, h] of hours) {
      const gameId = byIgdbId.get(igdbId);
      if (!gameId) continue;
      await db.game.update({ where: { id: gameId }, data: { hltbMainHours: h } });
      ttbEnriched++;
    }
    // Mark games with no time-to-beat record so we don't re-query them.
    const missingIgdbIds = igdbIds.filter((id) => !hours.has(id));
    if (missingIgdbIds.length > 0) {
      await db.game.updateMany({ where: { igdbId: { in: missingIgdbIds } }, data: { hltbMainHours: -1 } });
    }
  }

  // ── Step 3: drop UNTOUCHED Steam games IGDB has no record of ──────────────
  // Only prune games the user hasn't engaged with (still UNTRIAGED, unrated, no
  // notes) so we never lose a game someone has triaged, rated, or annotated.
  const toDrop = await db.userGame.findMany({
    where: {
      userId,
      source: "STEAM",
      status: "UNTRIAGED",
      rating: null,
      notes: null,
      game: { igdbId: null },
    },
    select: { id: true, game: { select: { title: true } } },
  });
  const dropped = toDrop.map((ug) => ug.game.title);
  if (dropped.length > 0) {
    await db.userGame.deleteMany({ where: { id: { in: toDrop.map((ug) => ug.id) } } });
  }
  // Reap Game rows no longer referenced by anyone (cheap; always worth running).
  await db.game.deleteMany({
    where: { igdbId: null, steamAppId: { not: null }, userGames: { none: {} } },
  });

  return { igdbEnriched, titleMatched, titleMatchRemaining, themesBackfilled, ttbEnriched, dropped };
}
