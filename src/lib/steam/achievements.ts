export type AchievementProgress = {
  total: number;
  achieved: number;
  recentUnlocks: Array<{ apiname: string; unlocktime: number }>;
};

/**
 * Fetch a user's achievement progress for a specific Steam game.
 * Returns null when the profile is private, the game has no achievements,
 * or the API call fails — caller should treat null as "no achievement data".
 */
export async function fetchAchievementProgress(
  steamAppId: number,
  steamId: string
): Promise<AchievementProgress | null> {
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) return null;

  const url = new URL(
    "https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/"
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamid", steamId);
  url.searchParams.set("appid", String(steamAppId));

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      playerstats?: {
        success?: boolean;
        achievements?: Array<{ apiname: string; achieved: number; unlocktime: number }>;
      };
    };

    if (!json.playerstats?.success || !json.playerstats.achievements) return null;

    const all = json.playerstats.achievements;
    const achieved = all.filter((a) => a.achieved === 1);

    return {
      total: all.length,
      achieved: achieved.length,
      recentUnlocks: achieved
        .sort((a, b) => b.unlocktime - a.unlocktime)
        .slice(0, 3)
        .map(({ apiname, unlocktime }) => ({ apiname, unlocktime })),
    };
  } catch {
    return null;
  }
}
