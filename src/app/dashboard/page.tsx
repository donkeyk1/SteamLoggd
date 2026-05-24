import Link from "next/link";
import { redirect } from "next/navigation";
import type { Game, GameStatus, UserGame } from "@prisma/client";
import { getSession } from "@/lib/session";
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

function formatHours(hours: number) {
  if (hours < 100) return `${hours.toFixed(0)} h`;
  return `${Math.round(hours).toLocaleString()} h`;
}

const STATUS_STYLES: Record<
  GameStatus,
  { label: string; bar: string; pill: string }
> = {
  WISHLIST: {
    label: "Wishlist",
    bar: "bg-violet-500",
    pill: "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30",
  },
  UNTRIAGED: {
    label: "Untriaged",
    bar: "bg-zinc-500",
    pill: "bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/30",
  },
  UNPLAYED: {
    label: "Unplayed",
    bar: "bg-zinc-400",
    pill: "bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/30",
  },
  PLAYING: {
    label: "Playing",
    bar: "bg-cyan-500",
    pill: "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30",
  },
  PAUSED: {
    label: "Paused",
    bar: "bg-amber-500",
    pill: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  },
  BEAT: {
    label: "Beat",
    bar: "bg-emerald-500",
    pill: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  },
  DROPPED: {
    label: "Dropped",
    bar: "bg-red-500",
    pill: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
  },
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session.userId) redirect("/");

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
    backlogHoursRows,
    beatStats,
    beatThisYear,
    unenrichedCount,
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
        { addedAt: "desc" },
      ],
      take: 10,
    }),
    db.userGame.groupBy({
      by: ["status"],
      where: { userId, isMultiplayer: false },
      _count: { status: true },
    }),
    db.userGame.findMany({
      where: {
        userId,
        status: { in: ["UNPLAYED", "PAUSED"] },
        isMultiplayer: false,
        OR: [{ platform: null }, { platform: { not: "Wishlist" } }],
        game: { hltbMainHours: { gt: 0 } },
      },
      select: { game: { select: { hltbMainHours: true } } },
    }),
    db.userGame.aggregate({
      where: { userId, status: "BEAT", rating: { not: null } },
      _avg: { rating: true },
    }),
    db.userGame.count({
      where: { userId, status: "BEAT", finishedAt: { gte: yearStart } },
    }),
    db.userGame.count({
      where: { userId, source: "STEAM", game: { igdbId: null } },
    }),
  ]);

  if (!user) {
    await session.destroy();
    redirect("/");
  }

  const backlogHoursTotal = backlogHoursRows.reduce(
    (sum, r) => sum + (r.game.hltbMainHours ?? 0),
    0
  );
  const avgRating = beatStats._avg.rating ?? 0;

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
      <header className="max-w-6xl mx-auto px-6 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {user.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="w-10 h-10 rounded-full ring-2 ring-violet-500/30"
            />
          )}
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
              Signed in as
            </p>
            <p className="text-sm font-semibold text-zinc-50">
              {user.displayName}
            </p>
          </div>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="text-sm text-zinc-500 hover:text-zinc-100 transition-colors"
          >
            Sign out
          </button>
        </form>
      </header>

      <div className="max-w-6xl mx-auto px-6 pb-12 space-y-8">
        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/recommend"
            className="text-sm rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 transition-all px-4 py-2 font-semibold text-white shadow-lg shadow-violet-500/20"
          >
            ✨ What should I play?
          </Link>
          <Link
            href="/backlog"
            className="text-sm rounded-lg border border-zinc-800 hover:bg-zinc-900 transition-colors px-4 py-2 text-zinc-300"
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
          <section className="space-y-3">
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
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          <StatCard
            value={formatHours(backlogHoursTotal)}
            label="Backlog hours"
            accent="cyan"
          />
          <StatCard
            value={avgRating > 0 ? `${avgRating.toFixed(1)}/5` : "—"}
            label="Avg rating"
            accent="amber"
          />
        </section>

        {/* Top picks + Status breakdown */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                Top picks for you
              </h2>
              <Link
                href="/recommend"
                className="text-xs text-violet-400 hover:text-violet-300"
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

          <div className="lg:col-span-2 rounded-xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur p-5">
            <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-4">
              By status
            </h2>
            <div className="space-y-2.5">
              {(Object.keys(STATUS_STYLES) as GameStatus[]).map((status) => {
                const count = statusCounts[status];
                const pct = statusTotal > 0 ? (count / statusTotal) * 100 : 0;
                const style = STATUS_STYLES[status];
                return (
                  <div key={status} className="flex items-center gap-2 text-sm">
                    <span className="w-20 text-xs text-zinc-400">
                      {style.label}
                    </span>
                    <div className="flex-1 h-2 bg-zinc-800/70 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${style.bar} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-xs text-right text-zinc-500 tabular-nums">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-zinc-600 mt-3">
              Single-player only · multiplayer tracked separately
            </p>
          </div>
        </section>

        {/* Hall of Fame */}
        {topRated.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
              Hall of Fame · highest-rated games
            </h2>
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2">
              {topRated.map((row) => (
                <div
                  key={row.id}
                  className="aspect-[3/4] rounded-md overflow-hidden relative group ring-1 ring-zinc-800/50 hover:ring-violet-500/60 transition-all hover:scale-105"
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
          <section className="space-y-3">
            <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
              Recent activity
            </h2>
            <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur overflow-hidden">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-zinc-800/50">
                  {recentGames.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-zinc-900/70 transition-colors"
                    >
                      <td className="pl-4 py-2 w-10">
                        {row.game.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.game.coverUrl}
                            alt=""
                            className="w-7 h-10 object-cover rounded"
                          />
                        ) : (
                          <div className="w-7 h-10 rounded bg-zinc-800" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-zinc-100">
                        {row.game.title}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
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
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-400 tabular-nums">
                        {formatPlaytime(row.steamPlaytimeMinutes)}
                      </td>
                      <td className="px-3 py-2 pr-4 text-right text-zinc-500 tabular-nums">
                        {row.lastPlayedAt
                          ? row.lastPlayedAt.toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
      className={`rounded-xl bg-gradient-to-br ${accentClass} to-zinc-900/40 border border-zinc-800/50 backdrop-blur p-5`}
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
    <div className="relative overflow-hidden rounded-2xl ring-1 ring-zinc-800/50 bg-zinc-900">
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
    <div className="flex gap-3 items-center">
      <span className="w-5 text-lg font-bold text-zinc-700 tabular-nums shrink-0">
        {rank}
      </span>
      {row.game.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.game.coverUrl}
          alt=""
          className="w-9 h-12 object-cover rounded shrink-0"
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
