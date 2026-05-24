import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  await db.$transaction([
    db.account.deleteMany({
      where: { userId: session.userId, provider: "steam" },
    }),
    db.user.update({
      where: { id: session.userId },
      data: { steamImage: null },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
