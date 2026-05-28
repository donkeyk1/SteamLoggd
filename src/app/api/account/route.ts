import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { signOut } from "@/auth";
import { db } from "@/lib/db";

/**
 * DELETE /api/account
 *
 * Permanently deletes the authenticated user and all associated data.
 * The Prisma schema uses `onDelete: Cascade` on every relation pointing
 * to User (Account, Session, UserGame, SyncJob), so a single User delete
 * removes everything as if the account never existed.
 */
export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await db.user.delete({ where: { id: session.userId } });
  } catch (err) {
    console.error("Failed to delete account:", err);
    return NextResponse.json(
      { error: "Failed to delete account. Please try again." },
      { status: 500 },
    );
  }

  // Sign out after deletion — clears the session cookie.
  // signOut() internally throws a redirect, so we call it in a fire-and-forget
  // manner and return a success response. The client handles the redirect.
  try {
    await signOut({ redirect: false });
  } catch {
    // signOut may throw if session is already gone; that's fine.
  }

  return NextResponse.json({ ok: true });
}
