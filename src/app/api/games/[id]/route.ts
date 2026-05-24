import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

const PatchSchema = z.object({
  status: z
    .enum(["WISHLIST", "UNTRIAGED", "UNPLAYED", "PLAYING", "PAUSED", "BEAT", "DROPPED"])
    .optional(),
  priority: z.coerce.number().int().min(1).max(5).optional(),
  notes: z.string().max(2000).nullable().optional(),
  rating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  isMultiplayer: z.boolean().optional(),
  wantReplay: z.boolean().optional(),
  platform: z.string().max(60).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await db.userGame.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const data = parsed.data;
  const updated = await db.userGame.update({
    where: { id },
    data: {
      ...data,
      // Stamp lifecycle dates so the recommender can use them later.
      ...(data.status === "PLAYING" && !existing.startedAt
        ? { startedAt: new Date() }
        : {}),
      ...(data.status === "BEAT" || data.status === "DROPPED"
        ? { finishedAt: existing.finishedAt ?? new Date() }
        : {}),
      // Clear replay flag when a game leaves BEAT status.
      ...(data.status && data.status !== "BEAT" ? { wantReplay: false } : {}),
    },
  });

  return NextResponse.json({ userGame: updated });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await db.userGame.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.userGame.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
