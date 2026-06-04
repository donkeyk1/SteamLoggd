import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { fetchOwnedGames } from "@/lib/steam/library";
import { enrichUserLibrary } from "@/lib/igdb/enrich";

// Enrichment may throttle title-matching for any non-Steam games in the library.
export const maxDuration = 60;

const BATCH = 20;

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  if (!session.steamId) return NextResponse.json({ error: "steam_not_linked" }, { status: 409 });

  const { userId, steamId } = session;
  const job = await db.syncJob.create({ data: { userId, type: "steam_library", status: "RUNNING" } });

  try {
    // ── Import the Steam library ───────────────────────────────────────────
    const games = await fetchOwnedGames(steamId);
    const named = games.filter((g) => !!g.name);

    for (let i = 0; i < named.length; i += BATCH) {
      await Promise.all(
        named.slice(i, i + BATCH).map((g) =>
          db.game.upsert({
            where: { steamAppId: g.appid },
            create: { steamAppId: g.appid, title: g.name! },
            update: { title: g.name! },
          })
        )
      );
    }

    const appIds = named.map((g) => g.appid);
    const gameRows = await db.game.findMany({
      where: { steamAppId: { in: appIds } },
      select: { id: true, steamAppId: true },
    });
    const gameByAppId = new Map(gameRows.map((r) => [r.steamAppId!, r.id]));

    let synced = 0;
    for (let i = 0; i < named.length; i += BATCH) {
      const results = await Promise.all(
        named.slice(i, i + BATCH).map((g) => {
          const gameId = gameByAppId.get(g.appid);
          if (!gameId) return null;
          const lastPlayedAt =
            g.rtime_last_played && g.rtime_last_played > 0
              ? new Date(g.rtime_last_played * 1000)
              : undefined;
          return db.userGame.upsert({
            where: { userId_gameId: { userId, gameId } },
            create: {
              userId, gameId, source: "STEAM",
              steamPlaytimeMinutes: g.playtime_forever,
              steamPlaytime2weeksMinutes: g.playtime_2weeks ?? null,
              lastPlayedAt,
            },
            update: {
              steamPlaytimeMinutes: g.playtime_forever,
              steamPlaytime2weeksMinutes: g.playtime_2weeks ?? null,
              ...(lastPlayedAt ? { lastPlayedAt } : {}),
            },
          });
        })
      );
      synced += results.filter(Boolean).length;
    }

    // ── Enrich (IGDB metadata + themes + time-to-beat, prune untouched junk) ─
    const enrich = await enrichUserLibrary(userId);

    await db.syncJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED", finishedAt: new Date() } });

    return NextResponse.json({ synced, total: games.length, ...enrich });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    await db.syncJob.update({ where: { id: job.id }, data: { status: "FAILED", finishedAt: new Date(), error: message } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
