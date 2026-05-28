import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { mergeUser } from "@/lib/merge-user";
import {
  fetchSteamProfile,
  verifySteamCallback,
} from "@/lib/steam-auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const steamId = await verifySteamCallback(req.url);
  if (!steamId) {
    return NextResponse.redirect(
      new URL("/settings/profile?error=steam_verify_failed", req.url)
    );
  }

  // Is this Steam ID already known? Either:
  //   - legacy user (only has the stub openid Account row, no oauth ones), or
  //   - already linked to a different OAuth-rooted user.
  const existingAccount = await db.account.findUnique({
    where: {
      provider_providerAccountId: { provider: "steam", providerAccountId: steamId },
    },
    include: {
      user: { include: { accounts: { select: { provider: true } } } },
    },
  });

  if (existingAccount && existingAccount.userId !== session.userId) {
    const otherUser = existingAccount.user;
    const hasOauth = otherUser.accounts.some((a) => a.provider !== "steam");

    if (hasOauth) {
      // The Steam account already belongs to someone else's real account.
      return NextResponse.redirect(
        new URL("/settings/profile?error=steam_already_linked", req.url)
      );
    }

    // Legacy user — fold them into the current OAuth-rooted user.
    await mergeUser({
      legacyUserId: existingAccount.userId,
      newUserId: session.userId,
    });
    // The legacy user is now deleted (cascading the stub Account row).
    // Insert a fresh real Account row for the current user.
    await attachSteamAccount(session.userId, steamId);
    return NextResponse.redirect(
      new URL("/settings/profile?success=steam_merged", req.url)
    );
  }

  if (existingAccount && existingAccount.userId === session.userId) {
    // Already linked to current user — re-link is a no-op.
    return NextResponse.redirect(
      new URL("/settings/profile?success=steam_already", req.url)
    );
  }

  // No existing Account for this Steam ID — attach a fresh one to the
  // current user.
  await attachSteamAccount(session.userId, steamId);
  return NextResponse.redirect(
    new URL("/settings/profile?success=steam_linked", req.url)
  );
}

async function attachSteamAccount(userId: string, steamId: string): Promise<void> {
  await db.account.create({
    data: {
      userId,
      type: "openid",
      provider: "steam",
      providerAccountId: steamId,
    },
  });

  // Always cache the Steam avatar in User.steamImage — the Avatar component
  // prefers it over the OAuth image. Best-effort: a failed fetch here just
  // means the user keeps showing their OAuth/placeholder avatar.
  const profile = await fetchSteamProfile(steamId).catch(() => null);
  if (profile?.avatarfull) {
    await db.user.update({
      where: { id: userId },
      data: { steamImage: profile.avatarfull },
    });
  }
}
