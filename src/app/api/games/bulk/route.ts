import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

const BulkPatchSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  updates: z
    .object({
      status: z
        .enum(["WISHLIST", "UNTRIAGED", "UNPLAYED", "PLAYING", "PAUSED", "BEAT", "DROPPED"])
        .optional(),
      priority: z.coerce.number().int().min(1).max(5).optional(),
      rating: z.coerce.number().int().min(1).max(5).nullable().optional(),
      isMultiplayer: z.boolean().optional(),
      wantReplay: z.boolean().optional(),
      platform: z.string().max(60).nullable().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: "no_updates" }),
});

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BulkPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { ids, updates } = parsed.data;

  const existing = await db.userGame.findMany({
    where: { id: { in: ids }, userId: session.userId },
    select: { id: true, status: true, startedAt: true, finishedAt: true },
  });
  if (existing.length !== ids.length) {
    return NextResponse.json({ error: "some_not_found" }, { status: 404 });
  }

  const now = new Date();
  const ops = existing.map((row) =>
    db.userGame.update({
      where: { id: row.id },
      data: {
        ...updates,
        ...(updates.status === "PLAYING" && !row.startedAt
          ? { startedAt: now }
          : {}),
        ...(updates.status === "BEAT" || updates.status === "DROPPED"
          ? { finishedAt: row.finishedAt ?? now }
          : {}),
        ...(updates.status && updates.status !== "BEAT"
          ? { wantReplay: false }
          : {}),
      },
    })
  );
  await db.$transaction(ops);

  return NextResponse.json({ updated: existing.length });
}

const BulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BulkDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { count } = await db.userGame.deleteMany({
    where: { id: { in: parsed.data.ids }, userId: session.userId },
  });
  return NextResponse.json({ deleted: count });
}
