/**
 * IGDB client using Twitch OAuth client-credentials grant.
 * Token is cached in-process (60-day TTL on Twitch side).
 */

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_BASE = "https://api.igdb.com/v4";

type TokenCache = { token: string; expiresAt: number };
let cached: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const res = await fetch(TWITCH_TOKEN_URL, { method: "POST", body });
  if (!res.ok) {
    throw new Error(`Twitch token fetch failed: ${res.status}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cached.token;
}

async function igdbFetch<T>(endpoint: string, query: string): Promise<T> {
  const token = await getAccessToken();
  const clientId = process.env.TWITCH_CLIENT_ID!;

  const res = await fetch(`${IGDB_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: query,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`IGDB ${endpoint} failed: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

export type IgdbGame = {
  id: number;
  name: string;
  first_release_date?: number; // unix seconds
  cover?: { image_id: string };
  genres?: { name: string }[];
  summary?: string;
};

export type GameSearchResult = {
  igdbId: number;
  title: string;
  releaseYear?: number;
  coverUrl?: string;
  genres: string[];
};

function buildCoverUrl(imageId?: string): string | undefined {
  if (!imageId) return undefined;
  // t_cover_big = 264x352. t_thumb = 90x128 for autocomplete; we'll use cover_big.
  return `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
}

function escapeIgdbString(s: string): string {
  return s.replace(/"/g, '\\"');
}

export async function searchGames(query: string, limit = 8): Promise<GameSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const escaped = escapeIgdbString(q);

  // Two strategies in parallel:
  //   1. `search` — uses IGDB's Sphinx index; great ranking when it works, but
  //      requires whole-word matches (fails for partial words like "rag").
  //   2. `where name ~ *"..."*` — case-insensitive substring; works for
  //      autocomplete-style partial typing, no ranking by relevance.
  // We merge the results, dedupe by igdbId, and prefer search-result order.
  const fields = "name, first_release_date, cover.image_id, genres.name";
  const searchQuery = `search "${escaped}"; fields ${fields}; where version_parent = null; limit ${limit};`;
  const substringQuery = `fields ${fields}; where name ~ *"${escaped}"* & version_parent = null; sort first_release_date desc; limit ${limit};`;

  const [searchResults, substringResults] = await Promise.all([
    igdbFetch<IgdbGame[]>("games", searchQuery).catch(() => [] as IgdbGame[]),
    igdbFetch<IgdbGame[]>("games", substringQuery).catch(() => [] as IgdbGame[]),
  ]);

  const seen = new Set<number>();
  const merged: IgdbGame[] = [];
  for (const g of [...searchResults, ...substringResults]) {
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    merged.push(g);
    if (merged.length >= limit) break;
  }

  return merged.map((g) => ({
    igdbId: g.id,
    title: g.name,
    releaseYear: g.first_release_date
      ? new Date(g.first_release_date * 1000).getUTCFullYear()
      : undefined,
    coverUrl: buildCoverUrl(g.cover?.image_id),
    genres: g.genres?.map((x) => x.name) ?? [],
  }));
}

/**
 * Look up IGDB games by Steam app IDs (category=1 in external_games).
 * Returns a map from steamAppId -> IGDB game data.
 */
export async function lookupBySteamAppIds(
  steamAppIds: number[]
): Promise<Map<number, GameSearchResult>> {
  const out = new Map<number, GameSearchResult>();
  if (steamAppIds.length === 0) return out;

  // external_games: external_game_source 1 = Steam. (The old `category` field
  // was deprecated; only `external_game_source` returns results now.)
  // uid is the Steam app id as a string. IGDB's IN syntax uses (a, b, c).
  const CHUNK = 100;
  for (let i = 0; i < steamAppIds.length; i += CHUNK) {
    const slice = steamAppIds.slice(i, i + CHUNK);
    const uidList = slice.map((id) => `"${id}"`).join(",");

    type ExternalGame = { uid: string; game: number };
    const externalQuery = `
      fields uid, game;
      where external_game_source = 1 & uid = (${uidList});
      limit ${CHUNK};
    `;
    const externals = await igdbFetch<ExternalGame[]>("external_games", externalQuery);
    if (externals.length === 0) continue;

    const gameIds = externals.map((e) => e.game);
    const gamesQuery = `
      fields id, name, first_release_date, cover.image_id, genres.name;
      where id = (${gameIds.join(",")});
      limit ${CHUNK};
    `;
    const games = await igdbFetch<IgdbGame[]>("games", gamesQuery);

    const gamesById = new Map(games.map((g) => [g.id, g]));
    for (const ext of externals) {
      const g = gamesById.get(ext.game);
      if (!g) continue;
      const steamAppId = Number(ext.uid);
      if (!Number.isFinite(steamAppId)) continue;
      out.set(steamAppId, {
        igdbId: g.id,
        title: g.name,
        releaseYear: g.first_release_date
          ? new Date(g.first_release_date * 1000).getUTCFullYear()
          : undefined,
        coverUrl: buildCoverUrl(g.cover?.image_id),
        genres: g.genres?.map((x) => x.name) ?? [],
      });
    }
  }
  return out;
}

/**
 * Look up main-story hours (IGDB's "hastily" field, in seconds → converted to hours)
 * for a batch of IGDB game ids. Returns a map from igdbId to hours.
 * Coverage is spotty — only games where users have submitted times appear.
 */
export async function fetchTimeToBeats(
  igdbIds: number[]
): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (igdbIds.length === 0) return out;

  type TimeToBeat = {
    game_id: number;
    hastily?: number;
    normally?: number;
    completely?: number;
  };

  const CHUNK = 200;
  for (let i = 0; i < igdbIds.length; i += CHUNK) {
    const slice = igdbIds.slice(i, i + CHUNK);
    const query = `
      fields game_id, hastily, normally, completely;
      where game_id = (${slice.join(",")});
      limit ${CHUNK};
    `;
    const rows = await igdbFetch<TimeToBeat[]>("game_time_to_beats", query);
    for (const r of rows) {
      // Prefer hastily (main story); fall back to normally (main + extras).
      const seconds = r.hastily ?? r.normally;
      if (!seconds || seconds <= 0) continue;
      out.set(r.game_id, seconds / 3600);
    }
  }
  return out;
}

export async function getGameById(igdbId: number): Promise<GameSearchResult | null> {
  const q = `
    fields name, first_release_date, cover.image_id, genres.name;
    where id = ${igdbId};
    limit 1;
  `;
  const results = await igdbFetch<IgdbGame[]>("games", q);
  const g = results[0];
  if (!g) return null;
  return {
    igdbId: g.id,
    title: g.name,
    releaseYear: g.first_release_date
      ? new Date(g.first_release_date * 1000).getUTCFullYear()
      : undefined,
    coverUrl: buildCoverUrl(g.cover?.image_id),
    genres: g.genres?.map((x) => x.name) ?? [],
  };
}
