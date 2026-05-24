import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { fetchOwnedGames } from "@/lib/steam/library";

export async function POST() {
  const session = await getSession();
  if (!session.userId || !session.steamId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { userId, steamId } = session;

  const job = await db.syncJob.create({
    data: { userId, type: "steam_library", status: "RUNNING" },
  });

  try {
    const games = await fetchOwnedGames(steamId);

    const named = games.filter((g) => !!g.name);

    // Upsert Game rows in parallel batches of 20
    const BATCH = 20;
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

    // Fetch all just-upserted game rows to get their IDs
    const appIds = named.map((g) => g.appid);
    const gameRows = await db.game.findMany({
      where: { steamAppId: { in: appIds } },
      select: { id: true, steamAppId: true },
    });
    const gameByAppId = new Map(gameRows.map((r) => [r.steamAppId!, r.id]));

    // Upsert UserGame rows in batches
    let upserted = 0;
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
              userId,
              gameId,
              source: "STEAM",
              steamPlaytimeMinutes: g.playtime_forever,
              lastPlayedAt,
            },
            update: {
              steamPlaytimeMinutes: g.playtime_forever,
              ...(lastPlayedAt ? { lastPlayedAt } : {}),
            },
          });
        })
      );
      upserted += results.filter(Boolean).length;
    }

    await db.syncJob.update({
      where: { id: job.id },
      data: { status: "SUCCEEDED", finishedAt: new Date() },
    });

    return NextResponse.json({ synced: upserted, total: games.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    await db.syncJob.update({
      where: { id: job.id },
      data: { status: "FAILED", finishedAt: new Date(), error: message },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
