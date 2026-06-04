import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  await db.account.deleteMany({
    where: { userId: session.userId, provider: "xbox" },
  });

  return NextResponse.json({ ok: true });
}
