import fs from "node:fs";
for (const path of [".env", ".env.local"]) {
  try {
    for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}

const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
  method: "POST",
  body: new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
    grant_type: "client_credentials",
  }),
});
const { access_token } = await tokenRes.json();

async function igdb(endpoint, query) {
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "text/plain",
    },
    body: query,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`${endpoint} ${res.status}: ${text}`);
    return null;
  }
  try { return JSON.parse(text); } catch { return text; }
}

console.log("\n--- game_time_to_beats: fields * ---");
console.log(JSON.stringify(await igdb("game_time_to_beats", "fields *; limit 3;"), null, 2));

console.log("\n--- games endpoint: fetch game_time_to_beats as nested expansion ---");
console.log(JSON.stringify(
  await igdb("games", "fields name, game_time_to_beats.*; where id = 1942; limit 1;"),
  null, 2
));
