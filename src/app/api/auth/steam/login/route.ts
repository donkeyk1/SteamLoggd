import { NextResponse } from "next/server";
import { getSteamLoginUrl } from "@/lib/steam-auth";

export async function GET() {
  const authUrl = await getSteamLoginUrl();
  return NextResponse.redirect(authUrl);
}
