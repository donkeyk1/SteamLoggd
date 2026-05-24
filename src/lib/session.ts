import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

export type SessionData = {
  userId?: string;
  steamId?: string;
  displayName?: string;
};

const password = process.env.SESSION_PASSWORD;
if (!password || password.length < 32) {
  throw new Error(
    "SESSION_PASSWORD must be set and at least 32 characters. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
  );
}

const sessionOptions: SessionOptions = {
  cookieName: "gamebacklog_session",
  password,
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
