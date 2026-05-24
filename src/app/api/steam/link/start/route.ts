import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSteamLoginUrl } from "@/lib/steam-auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/", process.env.AUTH_URL ?? "http://localhost:3000"));
  }
  const authUrl = await getSteamLoginUrl();
  return NextResponse.redirect(authUrl);
}
