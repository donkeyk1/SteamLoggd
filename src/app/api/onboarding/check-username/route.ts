import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  isReservedUsername,
  validateUsernameFormat,
  type UsernameCheckResult,
} from "@/lib/reserved-usernames";

export async function GET(req: NextRequest): Promise<NextResponse<UsernameCheckResult>> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { available: false, reason: "invalid" },
      { status: 401 }
    );
  }

  const raw = req.nextUrl.searchParams.get("username")?.trim() ?? "";
  if (!validateUsernameFormat(raw)) {
    return NextResponse.json({ available: false, reason: "invalid" });
  }
  if (isReservedUsername(raw)) {
    return NextResponse.json({ available: false, reason: "reserved" });
  }

  const existing = await db.user.findUnique({
    where: { username: raw },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ available: false, reason: "taken" });
  }

  return NextResponse.json({ available: true });
}
