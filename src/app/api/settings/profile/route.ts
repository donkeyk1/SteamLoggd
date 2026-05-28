import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(60).nullable(),
  image: z.string().url().max(500).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await db.user.update({
    where: { id: session.userId },
    data: parsed.data,
  });

  return NextResponse.json({ ok: true });
}
