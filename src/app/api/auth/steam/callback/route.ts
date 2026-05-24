import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { fetchSteamProfile, verifySteamCallback } from "@/lib/steam-auth";

export async function GET(req: NextRequest) {
  const steamId = await verifySteamCallback(req.url);
  if (!steamId) {
    return NextResponse.redirect(new URL("/?error=steam_verify_failed", req.url));
  }

  const profile = await fetchSteamProfile(steamId);
  const displayName = profile?.personaname ?? `Steam ${steamId}`;
  const avatarUrl = profile?.avatarfull;

  const user = await db.user.upsert({
    where: { steamId },
    create: { steamId, displayName, avatarUrl },
    update: { displayName, avatarUrl },
  });

  const session = await getSession();
  session.userId = user.id;
  session.steamId = user.steamId;
  session.displayName = user.displayName;
  await session.save();

  return NextResponse.redirect(new URL("/dashboard", req.url));
}
