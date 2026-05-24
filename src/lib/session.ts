import { auth } from "@/auth";

export type SessionData = {
  userId: string;
  username: string | null;
  name: string | null;
  image: string | null;
  steamId: string | null;
};

/**
 * Returns the current Auth.js session flattened into the shape the rest of
 * the app uses, or null if no one is signed in. Replaces the iron-session
 * helper that used to live here.
 */
export async function getSession(): Promise<SessionData | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    userId: session.user.id,
    username: session.user.username,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
    steamId: session.user.steamId,
  };
}
