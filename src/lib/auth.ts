import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/**
 * Require an authenticated session. Use in server components and route handlers.
 * Redirects to "/" if there's no session.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session.userId || !session.steamId) {
    redirect("/");
  }
  return session as Required<Pick<typeof session, "userId" | "steamId">> & typeof session;
}
