# Steamloggd

A personal game backlog tracker. Sign in with Steam to auto-sync your library, manually add games from any platform, and get recommendations based on your available time and mood.

Live at **[steamloggd.vercel.app](https://steamloggd.vercel.app)**

---

## Features

- **Steam library sync** — imports your owned games and playtime via the Steam Web API
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
| Auth | Custom Steam OpenID + iron-session |
| Game metadata | IGDB API (Twitch OAuth client credentials) |
| Time-to-beat | IGDB `game_time_to_beats` endpoint |
| Deployment | Vercel + Neon |

---

## Local development

### Prerequisites

- Node.js 20+
- Docker (for local Postgres)
- Steam API key — [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)
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

Required env vars:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gamebacklog
SESSION_PASSWORD=<at-least-32-character-random-string>
STEAM_API_KEY=<your-steam-api-key>
TWITCH_CLIENT_ID=<your-twitch-client-id>
TWITCH_CLIENT_SECRET=<your-twitch-client-secret>
NEXTAUTH_URL=http://localhost:3000
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

Open [http://localhost:3000](http://localhost:3000), sign in with Steam, and sync your library.

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
      auth/steam/          # Steam OpenID login + callback
      sync/steam/          # POST: refresh Steam library
      enrich/library/      # POST: IGDB + HLTB enrichment pass
      games/               # GET/POST: list + add single game
      games/[id]/          # PATCH/DELETE: update or remove a game
      games/bulk/          # PATCH/DELETE: bulk update or remove
      games/bulk-add/      # POST: add multiple games by title at once
      games/search/        # GET: IGDB autocomplete
      recommend/           # POST: { minutes, mood } → top 3 picks
    backlog/               # Full library page with filters + bulk actions
    dashboard/             # Currently playing + quick stats + sync/enrich
    recommend/             # Recommender UI
  lib/
    igdb/client.ts         # IGDB API wrapper (search, lookup, time-to-beat)
    steam/client.ts        # Steam Web API wrapper
    recommender/           # Scoring function + tunable weights
    db.ts                  # Prisma client singleton
    session.ts             # iron-session helper
prisma/
  schema.prisma            # User, Game, UserGame, SyncJob models
```
