import { redirect } from "next/navigation";
import { getSession, type SessionData } from "@/lib/session";

/**
 * Require an authenticated session. Use in server components and route handlers.
 * Redirects to "/" if there's no session.
 */
export async function requireSession(): Promise<SessionData> {
  const session = await getSession();
  if (!session) redirect("/");
  return session;
}

/**
 * Require an authenticated session with a linked Steam account. Use in
 * routes that need to call the Steam Web API (sync, achievements).
 * Returns the session with steamId narrowed to non-null.
 */
export async function requireSteamLink(): Promise<SessionData & { steamId: string }> {
  const session = await requireSession();
  if (!session.steamId) redirect("/settings/connections?error=steam_not_linked");
  return session as SessionData & { steamId: string };
}
