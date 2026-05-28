import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  isReservedUsername,
  validateUsernameFormat,
} from "@/lib/reserved-usernames";

const OnboardingSchema = z.object({
  username: z.string().trim().min(3).max(24),
  displayName: z.string().trim().min(1).max(60).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  if (session.username) {
    // Usernames are immutable post-signup. Refuse.
    return NextResponse.json(
      { error: "already_onboarded" },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = OnboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { username, displayName = username } = parsed.data;

  if (!validateUsernameFormat(username)) {
    return NextResponse.json(
      { error: "invalid_username_format" },
      { status: 400 }
    );
  }
  if (isReservedUsername(username)) {
    return NextResponse.json({ error: "reserved_username" }, { status: 400 });
  }

  try {
    await db.user.update({
      where: { id: session.userId },
      data: { username, name: displayName },
    });
  } catch (err) {
    // P2002 = unique constraint violation. Most likely the username got
    // taken between the live check and submit — race, not a bug.
    const code = (err as { code?: string } | null)?.code;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "username_taken" },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
