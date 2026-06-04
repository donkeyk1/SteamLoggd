import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { resolveGamertag } from "@/lib/xbox/client";

const LinkSchema = z.object({
  gamertag: z.string().trim().min(1).max(50),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = LinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  let profile;
  try {
    profile = await resolveGamertag(parsed.data.gamertag);
  } catch {
    return NextResponse.json({ error: "xbox_api_error" }, { status: 502 });
  }
  if (!profile) {
    return NextResponse.json({ error: "gamertag_not_found" }, { status: 404 });
  }

  // Already linked to this user → no-op success.
  const existing = await db.account.findUnique({
    where: { provider_providerAccountId: { provider: "xbox", providerAccountId: profile.xuid } },
  });
  if (existing) {
    if (existing.userId === session.userId) {
      return NextResponse.json({ ok: true, gamertag: profile.gamertag });
    }
    return NextResponse.json({ error: "already_linked_other" }, { status: 409 });
  }

  try {
    await db.account.create({
      data: {
        userId: session.userId,
        type: "xbox",
        provider: "xbox",
        providerAccountId: profile.xuid,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "already_linked_other" }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true, gamertag: profile.gamertag });
}
