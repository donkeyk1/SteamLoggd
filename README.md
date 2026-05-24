# Steamloggd

A personal game backlog tracker. Sign in with Google / GitHub / Discord, optionally link Steam to auto-sync your library, manually add games from any platform, and get recommendations based on your available time and mood.

Live at **[steamloggd.vercel.app](https://steamloggd.vercel.app)**

---

## Features

- **OAuth sign-in** — Google, GitHub, or Discord; multiple providers with the same verified email merge into one account
- **Optional Steam linking** — link from settings to sync your owned games and playtime via the Steam Web API
- **IGDB enrichment** — fetches cover art, genres, and release year for every game
- **HowLongToBeat** — pulls main-story hours so the recommender knows how long each game takes
- **Manual game entry** — add PlayStation, Epic, or any other game by title (single or bulk up to 30 at once)
- **Backlog management** — filter and sort by status, priority, playtime, or genre; inline edits
- **Bulk actions** — select multiple games to update status, priority, rating, platform, or delete
- **Recommender** — enter how much time you have and a mood; get top 3 picks with a one-line reason each
- **Statuses**: Untriaged → Unplayed → Playing → Paused → Beat / Dropped

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL via Prisma (Docker locally, Neon in prod) |
| Auth | Auth.js (NextAuth v5) — Google / GitHub / Discord OAuth + database sessions; Steam as optional secondary link |
| Game metadata | IGDB API (Twitch OAuth client credentials) |
| Time-to-beat | IGDB `game_time_to_beats` endpoint |
| Deployment | Vercel + Neon |

---

## Local development

### Prerequisites

- Node.js 20+
- Docker (for local Postgres)
- OAuth apps for at least one of the sign-in providers (callback URL is `http://localhost:3000/api/auth/callback/<provider>`):
  - Google — [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
  - GitHub — [GitHub Developer Settings → OAuth Apps](https://github.com/settings/developers)
  - Discord — [Discord Developer Portal](https://discord.com/developers/applications)
- (Optional, for Steam linking) Steam API key — [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)
- Twitch application (for IGDB) — [dev.twitch.tv/console](https://dev.twitch.tv/console)

### Setup

```bash
git clone https://github.com/<your-username>/GameBacklog.git
cd GameBacklog
npm install
```

Copy the env template and fill in your values:

```bash
cp .env.local.example .env.local
```

Required env vars (full list lives in `.env.local.example`):

```
DATABASE_URL=postgresql://gamebacklog:gamebacklog_dev@localhost:5432/gamebacklog
AUTH_SECRET=<openssl rand -base64 32>
AUTH_URL=http://localhost:3000

# At least one provider — leave the rest blank to disable
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
AUTH_DISCORD_ID=
AUTH_DISCORD_SECRET=

# Optional — needed only when users link Steam
STEAM_API_KEY=

# For game metadata enrichment
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
```

Start Postgres and run migrations:

```bash
docker compose up -d
npx prisma migrate deploy
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with your OAuth provider of choice, pick a username, and (optionally) link Steam from `/settings/connections` to sync your library.

---

## Deployment (Vercel + Neon)

1. Create a Neon project and copy the **direct** connection string (not the pooler URL — pooler blocks migrations).
2. Set all env vars above in Vercel project settings, using the Neon URL for `DATABASE_URL`.
3. The Vercel build command runs `prisma migrate deploy && next build` — migrations apply automatically on each deploy.

---

## Project structure

```
src/
  app/
    api/
      auth/[...nextauth]/  # Auth.js OAuth handler (Google / GitHub / Discord)
      auth/logout/         # POST: signs out via Auth.js
      onboarding/          # POST: claim username + display name on first sign-in
        check-username/    # GET: live availability check
      steam/
        link/start/        # GET: kick off Steam OpenID flow for current user
        link/callback/     # GET: verify Steam, attach Account or merge legacy user
        unlink/            # POST: remove the Steam Account row
      settings/profile/    # PATCH: edit display name + avatar
      sync/steam/          # POST: refresh Steam library (requires linked Steam)
      enrich/library/      # POST: IGDB + HLTB enrichment pass
      games/               # GET/POST: list + add single game
      games/[id]/          # PATCH/DELETE: update or remove a game
      games/bulk/          # PATCH/DELETE: bulk update or remove
      games/bulk-add/      # POST: add multiple games by title at once
      games/search/        # GET: IGDB autocomplete
      recommend/           # POST: { minutes, mood } → top 3 picks
    backlog/               # Full library page with filters + bulk actions
    dashboard/             # Currently playing + quick stats + sync/enrich
    onboarding/            # First-run username + display-name form
    recommend/             # Recommender UI
    settings/connections/  # Link/unlink OAuth providers and Steam
    settings/profile/      # Edit display name + avatar
  auth.ts                  # Auth.js config (providers, adapter, callbacks)
  proxy.ts                 # Forces signed-in users with no username to /onboarding
  lib/
    auth.ts                # requireSession / requireSteamLink helpers
    igdb/client.ts         # IGDB API wrapper (search, lookup, time-to-beat)
    merge-user.ts          # Folds a legacy User into a new OAuth-rooted one
    reserved-usernames.ts  # Format + reserved-name check
    steam/client.ts        # Steam Web API wrapper
    steam-auth.ts          # Steam OpenID URL + verification (reused by link flow)
    recommender/           # Scoring function + tunable weights
    db.ts                  # Prisma client singleton
    session.ts             # Thin Auth.js wrapper exposing { userId, steamId, … }
prisma/
  schema.prisma            # User, Account, Session, Game, UserGame, SyncJob models
```
