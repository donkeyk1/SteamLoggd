import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { fetchTitleHistory } from "@/lib/xbox/client";
import { enrichUserLibrary } from "@/lib/igdb/enrich";

// Title-matching is throttled, so allow a longer window than the default.
export const maxDuration = 60;

const BATCH = 20;

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const xbox = await db.account.findFirst({
    where: { userId: session.userId, provider: "xbox" },
    select: { providerAccountId: true },
  });
  if (!xbox) return NextResponse.json({ error: "xbox_not_linked" }, { status: 409 });

  const { userId } = session;
  const xuid = xbox.providerAccountId;
  const job = await db.syncJob.create({ data: { userId, type: "xbox_library", status: "RUNNING" } });

  try {
    const titles = await fetchTitleHistory(xuid);

    // Upsert Game rows keyed by Xbox title id.
    for (let i = 0; i < titles.length; i += BATCH) {
      await Promise.all(
        titles.slice(i, i + BATCH).map((t) =>
          db.game.upsert({
            where: { xboxTitleId: t.titleId },
            create: { xboxTitleId: t.titleId, title: t.name },
            update: { title: t.name },
          })
        )
      );
    }

    const titleIds = titles.map((t) => t.titleId);
    const gameRows = await db.game.findMany({
      where: { xboxTitleId: { in: titleIds } },
      select: { id: true, xboxTitleId: true },
    });
    const gameByTitleId = new Map(gameRows.map((r) => [r.xboxTitleId!, r.id]));

    // Upsert UserGame rows. Xbox's public API exposes no total playtime, only
    // last-played, so playtime stays null.
    let synced = 0;
    for (let i = 0; i < titles.length; i += BATCH) {
      const results = await Promise.all(
        titles.slice(i, i + BATCH).map((t) => {
          const gameId = gameByTitleId.get(t.titleId);
          if (!gameId) return null;
          return db.userGame.upsert({
            where: { userId_gameId: { userId, gameId } },
            create: {
              userId,
              gameId,
              source: "XBOX",
              ...(t.lastPlayed ? { lastPlayedAt: t.lastPlayed } : {}),
            },
            update: {
              ...(t.lastPlayed ? { lastPlayedAt: t.lastPlayed } : {}),
            },
          });
        })
      );
      synced += results.filter(Boolean).length;
    }

    // Match to IGDB by title (bounded/throttled), backfill themes + HLTB.
    const enrich = await enrichUserLibrary(userId);

    await db.syncJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED", finishedAt: new Date() } });

    return NextResponse.json({ synced, total: titles.length, ...enrich });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    await db.syncJob.update({ where: { id: job.id }, data: { status: "FAILED", finishedAt: new Date(), error: message } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
