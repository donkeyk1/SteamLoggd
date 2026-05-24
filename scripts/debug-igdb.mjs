// One-off diagnostic: hits IGDB directly to find out why external_games lookup
// is returning 0 matches. Run with:  node scripts/debug-igdb.mjs
import fs from "node:fs";

for (const path of [".env", ".env.local"]) {
  try {
    const content = fs.readFileSync(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* file missing is fine */
  }
}

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET not found in .env or .env.local");
  process.exit(1);
}

// 1. Get Twitch token
const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
  method: "POST",
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  }),
});
if (!tokenRes.ok) {
  console.error("Token fetch failed:", tokenRes.status, await tokenRes.text());
  process.exit(1);
}
const { access_token } = await tokenRes.json();
console.log("Got token:", access_token.slice(0, 8) + "...");

async function igdb(endpoint, query) {
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "text/plain",
    },
    body: query,
  });
  if (!res.ok) {
    console.error(`IGDB ${endpoint} failed:`, res.status, await res.text());
    return null;
  }
  return res.json();
}

// 2. Known Steam app IDs to test
const knownSteamIds = [
  440, // Team Fortress 2
  570, // Dota 2
  730, // CS:GO
  271590, // GTA V
  292030, // The Witcher 3
];

console.log("\n--- Test 1: external_games by Steam app id ---");
const externalQuery = `
  fields uid, game, category, external_game_source;
  where category = 1 & uid = (${knownSteamIds.map((id) => `"${id}"`).join(",")});
  limit 20;
`;
const externals = await igdb("external_games", externalQuery);
console.log("Returned", externals?.length ?? 0, "rows");
console.log(JSON.stringify(externals?.slice(0, 3), null, 2));

console.log("\n--- Test 2: try external_game_source instead of category ---");
const externalQuery2 = `
  fields uid, game, category, external_game_source;
  where external_game_source = 1 & uid = (${knownSteamIds.map((id) => `"${id}"`).join(",")});
  limit 20;
`;
const externals2 = await igdb("external_games", externalQuery2);
console.log("Returned", externals2?.length ?? 0, "rows");
console.log(JSON.stringify(externals2?.slice(0, 3), null, 2));

console.log("\n--- Test 3: list external_game_sources to find Steam's id ---");
const sources = await igdb(
  "external_game_sources",
  "fields id, name; limit 50;"
);
console.log(JSON.stringify(sources, null, 2));

console.log("\n--- Test 4: game_time_to_beats for The Witcher 3 (game id 1942) ---");
const ttb = await igdb(
  "game_time_to_beats",
  "fields game, hastily, normally, completely, count; where game = 1942; limit 1;"
);
console.log(JSON.stringify(ttb, null, 2));
