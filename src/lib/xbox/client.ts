/**
 * OpenXBL client (https://xbl.io) — a proxy over the Xbox Live "titlehub" API.
 * Auth is a single developer API key (X-Authorization header); we look users up
 * by gamertag → XUID, no per-user OAuth. Covers console AND PC/Game Pass titles
 * that integrate Xbox Live.
 *
 * Note: response schemas aren't published in OpenXBL's OpenAPI doc, so the
 * parsers below are defensive — they follow Microsoft's documented titlehub
 * shape but tolerate missing/renamed fields. If a field mapping is off, it's
 * isolated to this file.
 */

const XBL_BASE = "https://xbl.io/api/v2";

function xblHeaders(): HeadersInit {
  const key = process.env.XBOX_API_KEY;
  if (!key) throw new Error("XBOX_API_KEY is not set");
  return { "X-Authorization": key, Accept: "application/json" };
}

export type XboxProfile = { xuid: string; gamertag: string; avatarUrl?: string };

type ProfileSetting = { id: string; value: string };
type ProfileUser = {
  id?: string;
  xuid?: string;
  gamertag?: string;
  settings?: ProfileSetting[];
};

/** Resolve a gamertag to its stable XUID (plus display name + avatar).
 *  Throws with a descriptive message on API/HTTP errors (not "not found"). */
export async function resolveGamertag(gamertag: string): Promise<XboxProfile | null> {
  // Modern Xbox gamertags display as "Donkey#8758" but the lookup format is
  // "Donkey8758" (# removed, suffix kept) — matching the xbox.com URL format.
  const displayName = gamertag.trim().replace("#", "");
  const url = new URL(`${XBL_BASE}/friends/search`);
  url.searchParams.set("gt", displayName);

  const res = await fetch(url, {
    headers: xblHeaders(),
    cache: "no-store",
  });

  // Surface real error details so we can debug response shape issues.
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenXBL ${res.status}: ${body.slice(0, 300)}`);
  }

  const raw = await res.json().catch(() => null);

  const json = raw as {
    content?: { profileUsers?: ProfileUser[] };
    profileUsers?: ProfileUser[];
    people?: ProfileUser[];
  } | null;
  // OpenXBL wraps the actual payload in a `content` key.
  const user =
    json?.content?.profileUsers?.[0] ??
    json?.profileUsers?.[0] ??
    json?.people?.[0];
  if (!user) return null;

  const xuid = user.id ?? user.xuid;
  if (!xuid) return null;

  const settings = user.settings ?? [];
  const setting = (id: string) => settings.find((s) => s.id === id)?.value;
  return {
    xuid: String(xuid),
    gamertag: setting("Gamertag") ?? user.gamertag ?? gamertag,
    avatarUrl: setting("GameDisplayPicRaw"),
  };
}

export type XboxTitle = {
  titleId: string;
  name: string;
  lastPlayed?: Date;
  displayImage?: string;
  devices: string[];
};

type RawTitle = {
  titleId?: string | number;
  name?: string;
  type?: string;
  displayImage?: string;
  devices?: string[];
  titleHistory?: { lastTimePlayed?: string };
};

/** Fetch the user's full title history (games played across console + PC). */
export async function fetchTitleHistory(xuid: string): Promise<XboxTitle[]> {
  const res = await fetch(`${XBL_BASE}/player/titleHistory/${xuid}`, {
    headers: xblHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Xbox titleHistory failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json().catch(() => null)) as { titles?: RawTitle[] } | null;
  const titles = json?.titles ?? [];

  return titles
    .filter((t) => t.titleId != null && !!t.name && (t.type ? t.type === "Game" : true))
    .map((t) => ({
      titleId: String(t.titleId),
      name: t.name!,
      lastPlayed: t.titleHistory?.lastTimePlayed
        ? new Date(t.titleHistory.lastTimePlayed)
        : undefined,
      displayImage: t.displayImage,
      devices: t.devices ?? [],
    }));
}
