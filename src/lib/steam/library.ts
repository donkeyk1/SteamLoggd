export type SteamOwnedGame = {
  appid: number;
  name?: string;
  playtime_forever: number; // minutes
  playtime_2weeks?: number; // minutes
  rtime_last_played?: number; // unix seconds; 0 means never
  img_icon_url?: string;
};

type GetOwnedGamesResponse = {
  response?: {
    game_count?: number;
    games?: SteamOwnedGame[];
  };
};

export async function fetchOwnedGames(steamId: string): Promise<SteamOwnedGame[]> {
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) throw new Error("STEAM_API_KEY is not set");

  const url = new URL(
    "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/"
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamid", steamId);
  url.searchParams.set("include_appinfo", "true");
  url.searchParams.set("include_played_free_games", "true");
  url.searchParams.set("format", "json");

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Steam GetOwnedGames failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as GetOwnedGamesResponse;
  return json.response?.games ?? [];
}
