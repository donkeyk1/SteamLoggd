import Link from "next/link";
import { redirect } from "next/navigation";
import type { Game, GameStatus, UserGame } from "@prisma/client";
import { Avatar } from "@/components/avatar";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  fetchAchievementProgress,
  type AchievementProgress,
} from "@/lib/steam/achievements";
import { scoreGames, buildGenreAffinity } from "@/lib/recommender/score";
import { SyncSteamButton } from "./sync-button";
import { EnrichButton } from "./enrich-button";

function formatPlaytime(minutes: number | null | undefined) {
  if (!minutes) return "—";
  const hours = minutes / 60;
  if (hours < 10) return `${hours.toFixed(1)} h`;
  return `${Math.round(hours)} h`;
}


const STATUS_STYLES: Record<
  GameStatus,
  { label: string; bar: string; hex: string; pill: string }
> = {
  WISHLIST: {
    label: "Wishlist",
    bar: "bg-violet-500",
    hex: "#8b5cf6",
    pill: "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30",
  },
  UNTRIAGED: {
    label: "Untriaged",
    bar: "bg-zinc-500",
    hex: "#71717a",
    pill: "bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/30",
  },
  UNPLAYED: {
    label: "Unplayed",
    bar: "bg-zinc-400",
    hex: "#a1a1aa",
    pill: "bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/30",
  },
  PLAYING: {
    label: "Playing",
    bar: "bg-cyan-500",
    hex: "#06b6d4",
    pill: "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30",
  },
  PAUSED: {
    label: "Paused",
    bar: "bg-amber-500",
    hex: "#f59e0b",
    pill: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  },
  BEAT: {
    label: "Beat",
    bar: "bg-emerald-500",
    hex: "#10b981",
    pill: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  },
  DROPPED: {
    label: "Dropped",
    bar: "bg-red-500",
    hex: "#ef4444",
    pill: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
  },
};

export default async function DashboardPage() {
  const session = await requireSession();

  const userId = session.userId;
  const steamId = session.steamId;
  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const [
    user,
    playingGames,
    candidates,
    ratedBeat,
    topRated,
    recentGames,
    statusCountsRaw,
    beatThisYear,
    unenrichedCount,
    allUserGames,
  ] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      include: { _count: { select: { userGames: true } } },
    }),
    db.userGame.findMany({
      where: { userId, status: "PLAYING" },
      include: { game: true },
      orderBy: { lastPlayedAt: { sort: "desc", nulls: "last" } },
    }),
    db.userGame.findMany({
      where: {
        userId,
        isMultiplayer: false,
        AND: [
          { OR: [{ platform: null }, { platform: { not: "Wishlist" } }] },
          {
            OR: [
              { status: { in: ["UNPLAYED", "PAUSED"] } },
              { status: "BEAT", wantReplay: true },
            ],
          },
        ],
      },
      include: { game: true },
    }),
    db.userGame.findMany({
      where: {
        userId,
        status: { in: ["BEAT", "DROPPED"] },
        rating: { not: null },
      },
      select: { rating: true, game: { select: { genres: true } } },
    }),
    db.userGame.findMany({
      where: {
        userId,
        status: "BEAT",
        rating: { not: null },
        game: { coverUrl: { not: null } },
      },
      include: { game: true },
      orderBy: [{ rating: "desc" }, { finishedAt: "desc" }],
      take: 12,
    }),
    db.userGame.findMany({
      where: { userId },
      include: { game: true },
      orderBy: [
        { lastPlayedAt: { sort: "desc", nulls: "last" } },
        { steamPlaytime2weeksMinutes: { sort: "desc", nulls: "last" } },
        { addedAt: "desc" },
      ],
      take: 10,
    }),
    db.userGame.groupBy({
      by: ["status"],
      where: { userId, isMultiplayer: false },
      _count: { status: true },
    }),
    db.userGame.count({
      where: { userId, status: "BEAT", finishedAt: { gte: yearStart } },
    }),
    db.userGame.count({
      where: { userId, source: "STEAM", game: { igdbId: null } },
    }),
    db.userGame.findMany({
      where: { userId },
      select: {
        status: true,
        steamPlaytimeMinutes: true,
        manualPlaytimeMinutes: true,
        game: { select: { genres: true } },
      },
    }),
  ]);

  if (!user) {
    // Session points at a User row that no longer exists. Bounce to root;
    // Auth.js will clear the stale session on the next request.
    redirect("/");
  }

  // Compute top 3 genres weighted by playtime + beaten status
  const genreStats = new Map<string, { hours: number; beaten: number }>();
  for (const row of allUserGames) {
    const mins = (row.steamPlaytimeMinutes ?? 0) + (row.manualPlaytimeMinutes ?? 0);
    const hours = mins / 60;
    const isBeat = row.status === "BEAT";
    for (const genre of row.game.genres) {
      const prev = genreStats.get(genre) ?? { hours: 0, beaten: 0 };
      genreStats.set(genre, {
        hours: prev.hours + hours,
        beaten: prev.beaten + (isBeat ? 1 : 0),
      });
    }
  }
  const topGenres = [...genreStats.entries()]
    .map(([genre, stats]) => ({
      genre,
      hours: stats.hours,
      beaten: stats.beaten,
      score: stats.hours + stats.beaten * 10,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const totalSP = statusCountsRaw.reduce((sum, r) => sum + r._count.status, 0);
  const beatCount = statusCountsRaw.find((r) => r.status === "BEAT")?._count.status ?? 0;
  const completionPct = totalSP > 0 ? Math.round((beatCount / totalSP) * 100) : 0;

  const statusCounts: Record<GameStatus, number> = {
    WISHLIST: 0,
    UNTRIAGED: 0,
    UNPLAYED: 0,
    PLAYING: 0,
    PAUSED: 0,
    BEAT: 0,
    DROPPED: 0,
  };
  for (const row of statusCountsRaw) {
    statusCounts[row.status] = row._count.status;
  }
  const statusTotal = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const affinityMap = buildGenreAffinity(ratedBeat);
  const topPicks = scoreGames(candidates, 60, [], affinityMap).slice(0, 3);

  // Best-effort achievement fetch for up to 3 PLAYING games (parallel)
  const achievementsMap = new Map<string, AchievementProgress | null>();
  if (steamId && playingGames.length > 0) {
    const promises = playingGames
      .filter((g) => g.game.steamAppId)
      .slice(0, 3)
      .map(async (g) => {
        const ach = await fetchAchievementProgress(g.game.steamAppId!, steamId);
        return [g.id, ach] as const;
      });
    const results = await Promise.all(promises);
    for (const [id, ach] of results) achievementsMap.set(id, ach);
  }

  const currentYear = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="max-w-6xl mx-auto px-6 pt-6 pb-4 flex items-center justify-between animate-fade">
        <div className="flex items-center gap-3">
          <Avatar
            steamImage={user.steamImage}
            image={user.image}
            name={user.name ?? user.username}
          />
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
              Signed in as
            </p>
            <p className="text-sm font-semibold text-zinc-50">
              {user.name ?? user.username ?? "Anonymous"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/settings/connections"
            className="text-sm text-zinc-500 hover:text-zinc-100 transition-colors"
          >
            Settings
          </Link>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-sm text-zinc-500 hover:text-zinc-100 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 pb-12 space-y-8">
        {user._count.userGames === 0 && !steamId && (
          <div className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-5 py-3 text-sm text-violet-100">
            Already used Steamloggd before?{" "}
            <Link
              href="/settings/connections"
              className="font-semibold underline hover:text-white"
            >
              Link your Steam account
            </Link>{" "}
            to recover your backlog.
          </div>
        )}

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2 animate-in stagger-1">
          <Link
            href="/recommend"
            className="text-sm rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 px-4 py-2 font-semibold text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 btn-press"
          >
            ✨ What should I play?
          </Link>
          <Link
            href="/backlog"
            className="text-sm rounded-lg border border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700 px-4 py-2 text-zinc-300 btn-press"
          >
            Full backlog →
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <SyncSteamButton />
            {unenrichedCount > 0 && (
              <EnrichButton initialUnenriched={unenrichedCount} />
            )}
          </div>
        </div>

        {/* NOW PLAYING hero */}
        {playingGames.length > 0 && (
          <section className="space-y-3 animate-in stagger-2">
            <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
              Now Playing
            </h2>
            <div
              className={`grid gap-4 ${
                playingGames.length === 1
                  ? "grid-cols-1"
                  : "grid-cols-1 md:grid-cols-2"
              }`}
            >
              {playingGames.slice(0, 4).map((row) => (
                <NowPlayingCard
                  key={row.id}
                  row={row}
                  achievements={achievementsMap.get(row.id) ?? null}
                />
              ))}
            </div>
          </section>
        )}

        {/* Stat cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-in stagger-3">
          <StatCard
            value={user._count.userGames.toLocaleString()}
            label="Games tracked"
            accent="violet"
          />
          <StatCard
            value={beatThisYear.toString()}
            label={`Beat in ${currentYear}`}
            accent="emerald"
          />
          <CompletionCard pct={completionPct} beaten={beatCount} total={totalSP} />
          <TopGenresCard genres={topGenres.map((g) => ({ name: g.genre, hours: g.hours, beaten: g.beaten }))} />
        </section>

        {/* Top picks + Status breakdown */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-4 animate-in stagger-4">
          <div className="lg:col-span-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 backdrop-blur p-5 card-hover">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Top picks for you
              </h2>
              <Link
                href="/recommend"
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                Customize →
              </Link>
            </div>
            {topPicks.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No unplayed games. Add some from the backlog!
              </p>
            ) : (
              <div className="space-y-3">
                {topPicks.map(({ row, why }, i) => (
                  <TopPickRow key={row.id} rank={i + 1} row={row} why={why} />
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 backdrop-blur p-5 card-hover">
            <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-4">
              By status
            </h2>

            <div className="flex items-center gap-5">
              {/* Donut chart */}
              <DonutChart statusCounts={statusCounts} total={statusTotal} />

              {/* Legend */}
              <div className="flex-1 space-y-1.5">
                {(Object.keys(STATUS_STYLES) as GameStatus[])
                  .sort((a, b) => statusCounts[b] - statusCounts[a])
                  .map((status) => {
                  const count = statusCounts[status];
                  const style = STATUS_STYLES[status];
                  return (
                    <div key={status} className="flex items-center gap-2 text-sm">
                      <span className={`w-2 h-2 rounded-full ${style.bar} shrink-0`} />
                      <span className="flex-1 text-xs text-zinc-400">
                        {style.label}
                      </span>
                      <span className="text-xs text-zinc-500 tabular-nums">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-[10px] text-zinc-600 mt-3">
              Single-player only · multiplayer tracked separately
            </p>
          </div>
        </section>

        {/* Hall of Fame */}
        {topRated.length > 0 && (
          <section className="space-y-3 animate-in stagger-5">
            <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
              Hall of Fame · highest-rated games
            </h2>
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2">
              {topRated.map((row) => (
                <div
                  key={row.id}
                  className="aspect-[3/4] rounded-md overflow-hidden relative group ring-1 ring-zinc-800/50 hover:ring-violet-500/60 transition-all duration-200 hover:scale-110 hover:z-10 hover:shadow-lg hover:shadow-violet-500/20"
                  title={`${row.game.title} · ${row.rating}/5`}
                >
                  {row.game.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.game.coverUrl}
                      alt={row.game.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                    <p className="text-[10px] font-semibold text-white line-clamp-2 leading-tight">
                      {row.game.title}
                    </p>
                    <p className="text-[10px] text-amber-400 mt-0.5">
                      {"★".repeat(row.rating ?? 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent activity */}
        {recentGames.length > 0 && (
          <section className="space-y-3 animate-in stagger-6">
            <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
              Recent activity
            </h2>
            <div className="space-y-2">
              {recentGames.map((row) => (
                <div
                  key={row.id}
                  className="group rounded-xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur p-3 flex items-center gap-4 hover:bg-zinc-800/50 hover:border-zinc-700/50 card-hover"
                >
                  {row.game.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.game.coverUrl}
                      alt=""
                      className="w-10 h-14 object-cover rounded-md shadow-md shadow-black/30 shrink-0 group-hover:shadow-lg group-hover:shadow-black/40 transition-shadow"
                    />
                  ) : (
                    <div className="w-10 h-14 rounded-md bg-zinc-800 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-100 truncate">
                      {row.game.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium ${
                          STATUS_STYLES[row.status].pill
                        }`}
                      >
                        {STATUS_STYLES[row.status].label}
                      </span>
                      {row.isMultiplayer && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30">
                          MP
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-zinc-400 tabular-nums">
                      {formatPlaytime(row.steamPlaytimeMinutes)}
                    </p>
                    <p className="text-xs text-zinc-600 tabular-nums">
                      {row.lastPlayedAt
                        ? row.lastPlayedAt.toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/backlog"
              className="block text-xs text-zinc-500 hover:text-zinc-300 text-right"
            >
              View full backlog →
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}

function StatCard({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent: "violet" | "emerald" | "cyan" | "amber";
}) {
  const accentClass = {
    violet: "from-violet-500/15",
    emerald: "from-emerald-500/15",
    cyan: "from-cyan-500/15",
    amber: "from-amber-500/15",
  }[accent];

  return (
    <div
      className={`rounded-xl bg-gradient-to-br ${accentClass} to-zinc-900/40 border border-zinc-800/50 backdrop-blur p-5 card-hover`}
    >
      <div className="text-2xl md:text-3xl font-bold text-zinc-50 tabular-nums">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1 font-bold">
        {label}
      </div>
    </div>
  );
}

function CompletionCard({
  pct,
  beaten,
  total,
}: {
  pct: number;
  beaten: number;
  total: number;
}) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-cyan-500/15 to-zinc-900/40 border border-zinc-800/50 backdrop-blur p-5 card-hover">
      <div className="flex items-end gap-2">
        <div className="text-2xl md:text-3xl font-bold text-zinc-50 tabular-nums">
          {pct}%
        </div>
        <span className="text-xs text-zinc-500 mb-1 tabular-nums">
          {beaten}/{total}
        </span>
      </div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1 font-bold">
        Completion rate
      </div>
      <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DonutChart({
  statusCounts,
  total,
}: {
  statusCounts: Record<GameStatus, number>;
  total: number;
}) {
  const displaySize = 120;
  const scale = 3;
  const size = displaySize * scale;
  const strokeWidth = 14 * scale;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = 4 * scale;

  const activeStatuses = (Object.keys(STATUS_STYLES) as GameStatus[]).filter(
    (s) => statusCounts[s] > 0
  );
  const totalGap = activeStatuses.length > 1 ? gap * activeStatuses.length : 0;
  const usable = circumference - totalGap;

  let offset = 0;
  const segments = activeStatuses.map((status) => {
    const pct = statusCounts[status] / total;
    const dashLength = pct * usable;
    const seg = { status, dashLength, offset, hex: STATUS_STYLES[status].hex };
    offset += dashLength + gap;
    return seg;
  });

  return (
    <div className="relative shrink-0" style={{ width: displaySize, height: displaySize }}>
      <svg
        width={displaySize}
        height={displaySize}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#27272a"
          strokeWidth={strokeWidth}
        />
        {segments.map((seg) => (
          <circle
            key={seg.status}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.hex}
            strokeWidth={strokeWidth}
            strokeDasharray={`${seg.dashLength} ${circumference - seg.dashLength}`}
            strokeDashoffset={-seg.offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-zinc-50 tabular-nums leading-none">
          {total}
        </span>
        <span className="text-[9px] uppercase tracking-widest text-zinc-500 mt-0.5">
          games
        </span>
      </div>
    </div>
  );
}

function TopGenresCard({
  genres,
}: {
  genres: { name: string; hours: number; beaten: number }[];
}) {
  const medals = ["text-amber-400", "text-zinc-400", "text-amber-700"];
  const medalLabels = ["1st", "2nd", "3rd"];
  return (
    <div className="rounded-xl bg-gradient-to-br from-amber-500/15 to-zinc-900/40 border border-zinc-800/50 backdrop-blur p-5 card-hover">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">
        Top genres
      </div>
      {genres.length === 0 ? (
        <p className="text-sm text-zinc-600">No genre data yet</p>
      ) : (
        <div className="space-y-1.5">
          {genres.map((g, i) => (
            <div key={g.name} className="flex items-center gap-2">
              <span
                className={`text-xs font-bold w-7 shrink-0 ${medals[i] ?? "text-zinc-600"}`}
              >
                {medalLabels[i]}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-zinc-200 truncate block">{g.name}</span>
                <span className="text-[10px] text-zinc-500 tabular-nums">
                  {g.hours < 1 ? "<1" : Math.round(g.hours)}h played
                  {g.beaten > 0 && ` · ${g.beaten} beaten`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NowPlayingCard({
  row,
  achievements,
}: {
  row: UserGame & { game: Game };
  achievements: AchievementProgress | null;
}) {
  const game = row.game;
  const playedHrs = row.steamPlaytimeMinutes ? row.steamPlaytimeMinutes / 60 : 0;
  const hltb = game.hltbMainHours;
  const beatProgress =
    hltb && hltb > 0 ? Math.min(100, (playedHrs / hltb) * 100) : null;
  const achievementPct =
    achievements && achievements.total > 0
      ? (achievements.achieved / achievements.total) * 100
      : null;

  return (
    <div className="relative overflow-hidden rounded-2xl ring-1 ring-zinc-800/50 hover:ring-cyan-500/30 bg-zinc-900 card-hover">
      {game.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={game.coverUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-30"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/30 via-zinc-950/75 to-zinc-950" />

      <div className="relative z-10 flex gap-4 p-5">
        {game.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.coverUrl}
            alt={game.title}
            className="w-20 md:w-24 h-28 md:h-32 object-cover rounded-lg shadow-xl shadow-black/50 shrink-0"
          />
        ) : (
          <div className="w-20 md:w-24 h-28 md:h-32 rounded-lg bg-zinc-800 shrink-0" />
        )}

        <div className="flex-1 min-w-0 space-y-2.5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold mb-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Now Playing
            </p>
            <h3 className="text-lg md:text-xl font-bold text-zinc-50 leading-tight line-clamp-2">
              {game.title}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
            <span className="tabular-nums">{playedHrs.toFixed(1)} h played</span>
            {row.lastPlayedAt && (
              <span>Last {row.lastPlayedAt.toLocaleDateString()}</span>
            )}
            {hltb && hltb > 0 && <span>~{hltb.toFixed(0)} h to beat</span>}
          </div>

          {beatProgress !== null && (
            <div>
              <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                <span>Progress to beat</span>
                <span className="tabular-nums">{Math.round(beatProgress)}%</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-violet-500"
                  style={{ width: `${beatProgress}%` }}
                />
              </div>
            </div>
          )}

          {achievementPct !== null && achievements && (
            <div>
              <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                <span>Achievements</span>
                <span className="tabular-nums">
                  {achievements.achieved} / {achievements.total}
                </span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-300"
                  style={{ width: `${achievementPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TopPickRow({
  rank,
  row,
  why,
}: {
  rank: number;
  row: UserGame & { game: Game };
  why: string;
}) {
  return (
    <div className="flex gap-3 items-center rounded-lg px-2 py-1.5 -mx-2 hover:bg-zinc-800/50 transition-all duration-200 group">
      <span className="w-5 text-lg font-bold text-zinc-700 tabular-nums shrink-0 group-hover:text-zinc-500 transition-colors">
        {rank}
      </span>
      {row.game.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.game.coverUrl}
          alt=""
          className="w-9 h-12 object-cover rounded shrink-0 group-hover:shadow-md group-hover:shadow-black/40 transition-shadow"
        />
      ) : (
        <div className="w-9 h-12 rounded bg-zinc-800 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-100 truncate">
          {row.game.title}
        </p>
        <p className="text-xs text-zinc-500 italic truncate">{why}</p>
      </div>
      {row.game.hltbMainHours && row.game.hltbMainHours > 0 && (
        <span className="text-xs text-zinc-500 tabular-nums shrink-0">
          ~{row.game.hltbMainHours.toFixed(0)} h
        </span>
      )}
    </div>
  );
}
