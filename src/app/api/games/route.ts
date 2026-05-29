import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { fetchTimeToBeats } from "@/lib/igdb/client";

const AddGameSchema = z.object({
  title: z.string().trim().min(1).max(200),
  status: z
    .enum(["WISHLIST", "UNTRIAGED", "UNPLAYED", "PLAYING", "PAUSED", "BEAT", "DROPPED"])
    .default("UNTRIAGED"),
  priority: z.coerce.number().int().min(1).max(5).default(3),
  rating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  platform: z.string().max(60).optional(),
  notes: z.string().max(2000).optional(),
  // Optional IGDB metadata captured from autocomplete
  igdbId: z.number().int().positive().optional(),
  coverUrl: z.string().url().max(500).optional(),
  genres: z.array(z.string().max(60)).max(20).optional(),
  themes: z.array(z.string().max(60)).max(20).optional(),
  releaseYear: z.number().int().min(1950).max(2100).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = AddGameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { title, status, priority, rating, platform, notes, igdbId, coverUrl, genres, themes, releaseYear } =
    parsed.data;

  // Best-effort IGDB time-to-beat lookup. Only works if we have an IGDB id.
  let hltbMainHours: number | null = null;
  if (igdbId) {
    const ttb = await fetchTimeToBeats([igdbId]).catch(() => new Map());
    hltbMainHours = ttb.get(igdbId) ?? null;
  }

  // If IGDB id is provided, dedupe on it (the same game might already exist
  // because another user added it or it overlaps with a Steam entry).
  const game = igdbId
    ? await db.game.upsert({
        where: { igdbId },
        create: {
          igdbId,
          title,
          coverUrl,
          genres: genres ?? [],
          themes: themes ?? [],
          releaseYear,
          hltbMainHours,
        },
        update: {
          title,
          ...(coverUrl ? { coverUrl } : {}),
          ...(genres && genres.length ? { genres } : {}),
          ...(themes && themes.length ? { themes } : {}),
          ...(releaseYear ? { releaseYear } : {}),
          ...(hltbMainHours ? { hltbMainHours } : {}),
        },
      })
    : await db.game.create({
        data: {
          title,
          coverUrl,
          genres: genres ?? [],
          themes: themes ?? [],
          releaseYear,
          hltbMainHours,
        },
      });

  // The same user shouldn't be able to add the same game twice.
  const existing = await db.userGame.findUnique({
    where: { userId_gameId: { userId: session.userId, gameId: game.id } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "already_in_library", userGameId: existing.id },
      { status: 409 }
    );
  }

  const isFinished = status === "BEAT" || status === "DROPPED";

  const userGame = await db.userGame.create({
    data: {
      userId: session.userId,
      gameId: game.id,
      source: "MANUAL",
      platform: platform ?? null,
      status,
      priority,
      rating: rating ?? null,
      notes,
      ...(isFinished ? { finishedAt: new Date() } : {}),
    },
    include: { game: true },
  });

  return NextResponse.json({ userGame }, { status: 201 });
}
