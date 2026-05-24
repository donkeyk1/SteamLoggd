import { RelyingParty } from "openid";

const STEAM_OPENID_URL = "https://steamcommunity.com/openid";

function getReturnUrl() {
  const base =
    process.env.APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  return `${base}/api/steam/link/callback`;
}

function getRelyingParty() {
  return new RelyingParty(getReturnUrl(), null, true, false, []);
}

export function getSteamLoginUrl(): Promise<string> {
  const rp = getRelyingParty();
  return new Promise((resolve, reject) => {
    rp.authenticate(STEAM_OPENID_URL, false, (err, authUrl) => {
      if (err || !authUrl) {
        reject(err ?? new Error("Failed to build Steam auth URL"));
        return;
      }
      resolve(authUrl);
    });
  });
}

/**
 * Verifies the OpenID response from Steam and returns the user's 64-bit Steam ID.
 * Returns null if verification fails.
 */
export function verifySteamCallback(url: string): Promise<string | null> {
  const rp = getRelyingParty();
  return new Promise((resolve) => {
    rp.verifyAssertion(url, (err, result) => {
      if (err || !result?.authenticated || !result.claimedIdentifier) {
        resolve(null);
        return;
      }
      const match = result.claimedIdentifier.match(/\/id\/(\d{17})$/);
      resolve(match?.[1] ?? null);
    });
  });
}

type SteamPlayerSummary = {
  steamid: string;
  personaname: string;
  avatarfull: string;
};

export async function fetchSteamProfile(
  steamId: string
): Promise<SteamPlayerSummary | null> {
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) throw new Error("STEAM_API_KEY is not set");

  const url = new URL(
    "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/"
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamids", steamId);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    response?: { players?: SteamPlayerSummary[] };
  };
  return json.response?.players?.[0] ?? null;
}
