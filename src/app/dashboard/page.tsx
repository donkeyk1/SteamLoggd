import Link from "next/link";
import { redirect } from "next/navigation";
import type { Game, GameStatus, UserGame } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  fetchAchievementProgress,
  type AchievementProgress,
} from "@/lib/steam/achievements";
import {
  scoreGames,
  buildGenreAffinity,
  buildCurrentTaste,
  selectPicks,
  type AffinityInput,
} from "@/lib/recommender/score";
import { TopNav } from "@/components/ui/top-nav";
import { GameCover } from "@/components/ui/game-cover";
import { StatusPill } from "@/components/ui/status-pill";
import { ProgressBar } from "@/components/ui/progress-bar";
import { DiceIcon, SparkleIcon, ArrowRight, StarIcon } from "@/components/ui/icons";
import { SyncButton } from "./sync-button";

function formatPlaytime(minutes: number | null | undefined) {
  if (!minutes) return "—";
  const hours = minutes / 60;
  if (hours < 10) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours)}h`;
}

const STATUS_STYLES: Record<
  GameStatus,
  { label: string; hex: string }
> = {
  WISHLIST: { label: "Wishlist", hex: "#8b5cf6" },
  UNTRIAGED: { label: "Untriaged", hex: "#71717a" },
  UNPLAYED: { label: "Unplayed", hex: "#a1a1aa" },
  PLAYING: { label: "Playing", hex: "#22d3ee" },
  PAUSED: { label: "Paused", hex: "#fbbf24" },
  BEAT: { label: "Beat", hex: "#10b981" },
  DROPPED: { label: "Dropped", hex: "#f43f5e" },
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
    opinionGames,
    topRated,
    statusCountsRaw,
    beatThisYear,
    allUserGames,
    xboxAccount,
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
        status: { in: ["BEAT", "DROPPED", "PLAYING", "PAUSED"] },
      },
      select: {
        status: true,
        rating: true,
        steamPlaytimeMinutes: true,
        manualPlaytimeMinutes: true,
        game: { select: { genres: true, hltbMainHours: true } },
      },
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
    db.userGame.groupBy({
      by: ["status"],
      where: { userId, isMultiplayer: false },
      _count: { status: true },
    }),
    db.userGame.count({
      where: { userId, status: "BEAT", finishedAt: { gte: yearStart } },
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
    db.account.findFirst({
      where: { userId, provider: "xbox" },
      select: { id: true },
    }),
  ]);

  const xboxLinked = !!xboxAccount;

  if (!user) redirect("/");


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
    WISHLIST: 0, UNTRIAGED: 0, UNPLAYED: 0, PLAYING: 0, PAUSED: 0, BEAT: 0, DROPPED: 0,
  };
  for (const row of statusCountsRaw) {
    statusCounts[row.status] = row._count.status;
  }
  const statusTotal = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const affinityInput: AffinityInput[] = opinionGames.map((g) => ({
    status: g.status,
    rating: g.rating,
    playtimeMinutes: (g.steamPlaytimeMinutes ?? 0) + (g.manualPlaytimeMinutes ?? 0),
    hltbMainHours: g.game.hltbMainHours,
    genres: g.game.genres,
  }));
  const affinityMap = buildGenreAffinity(affinityInput);
  const currentTaste = buildCurrentTaste(playingGames.map((p) => ({ genres: p.game.genres })));
  const topPicks = selectPicks(
    scoreGames(
      candidates,
      { vibes: [], genres: [], sessionMinutes: 120, desiredLength: "any" },
      affinityMap,
      currentTaste
    ),
    3,
    { diversityPenalty: 0.15 }
  );

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
  const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();

  return (
    <main className="min-h-screen md:h-screen md:overflow-hidden hf-scroll flex flex-col" style={{ background: "var(--hf-bg)" }}>
      <TopNav active="dashboard" username={user.username ?? user.name} steamLinked={!!steamId} />

      <div className="flex-1 flex flex-col gap-5 px-4 pt-5 pb-24 md:px-9 md:pt-6 md:pb-8 md:min-h-0 md:overflow-y-auto">
        {/* Greeting */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-end animate-fade">
          <div>
            <div className="hf-cap" style={{ marginBottom: 4 }}>WELCOME BACK · {dayName}</div>
            <h1 className="text-[26px] sm:text-3xl" style={{ fontWeight: 600, letterSpacing: "-0.03em", margin: 0, lineHeight: 1.05 }}>
              Hey, {user.username ?? user.name ?? "there"}.
            </h1>
            <div style={{ fontSize: 14, color: "var(--hf-fg-muted)", marginTop: 6 }}>
              <span style={{ color: "var(--hf-fg)", fontWeight: 500 }}>{user._count.userGames} games tracked</span>
              {" · "}{beatThisYear} beat this year
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {steamId && <SyncButton endpoint="/api/sync/steam" label="Sync Steam" />}
            {xboxLinked && <SyncButton endpoint="/api/sync/xbox" label="Sync Xbox" />}
            <Link href="/recommend" className="hf-btn hf-btn-primary btn-press">
              <DiceIcon size={14} /> What should I play?
            </Link>
          </div>
        </div>

        {/* NOW PLAYING hero */}
        {playingGames.length > 0 && (
          <section className="animate-in stagger-1 flex flex-col md:flex-row gap-3.5">
            {playingGames.map((row) => (
              <NowPlayingHero
                key={row.id}
                row={row}
                achievements={achievementsMap.get(row.id) ?? null}
                compact={playingGames.length > 1}
              />
            ))}
          </section>
        )}

        {/* Stat row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 animate-in stagger-2">
          <StatTile label="GAMES TRACKED" value={user._count.userGames.toLocaleString()} sub={`${topGenres.length > 0 ? topGenres[0].genre + " dominant" : ""}`} accent="var(--hf-violet)" />
          <StatTile label={`BEAT IN ${currentYear}`} value={beatThisYear.toString()} color="var(--hf-emerald)" accent="var(--hf-emerald)" />
          <div className="hf-card card-hover p-[18px] relative overflow-hidden flex flex-col justify-between" style={{ minHeight: 130 }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 60% at 100% 0%, rgba(34,211,238,0.1) 0%, transparent 60%)" }} />
            <div className="hf-cap relative">COMPLETION RATE</div>
            <div className="relative">
              <div className="flex items-baseline gap-2">
                <div style={{ fontSize: 42, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {completionPct}<span style={{ fontSize: 22, color: "var(--hf-fg-muted)" }}>%</span>
                </div>
                <div className="hf-mono" style={{ fontSize: 12, color: "var(--hf-fg-muted)" }}>{beatCount}/{totalSP}</div>
              </div>
              <ProgressBar pct={completionPct} color="var(--hf-cyan)" height={5} className="mt-3" />
            </div>
          </div>
          <div className="hf-card card-hover p-[18px] relative overflow-hidden flex flex-col justify-between" style={{ minHeight: 130 }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 60% at 100% 0%, rgba(251,191,36,0.1) 0%, transparent 60%)" }} />
            <div className="hf-cap relative">TOP GENRES</div>
            <div className="relative flex flex-col gap-[7px]">
              {topGenres.length === 0 ? (
                <span style={{ fontSize: 13, color: "var(--hf-fg-dim)" }}>No genre data yet</span>
              ) : (
                topGenres.map((g, i) => (
                  <div key={g.genre} className="flex items-baseline gap-2">
                    <span className="hf-mono" style={{ fontSize: 10, color: "var(--hf-amber)", width: 14 }}>{i + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, flex: 1, letterSpacing: "-0.005em" }}>{g.genre}</span>
                    <span className="hf-mono" style={{ fontSize: 10.5, color: "var(--hf-fg-dim)" }}>
                      {g.hours < 1 ? "<1" : Math.round(g.hours)}h
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Two col: Quick Picks + By Status */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3.5 animate-in stagger-3">
          <QuickPicks picks={topPicks} />
          <ByStatus statusCounts={statusCounts} total={statusTotal} />
        </div>

        {/* Hall of Fame */}
        {topRated.length > 0 && (
          <section className="animate-in stagger-4">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="hf-cap" style={{ color: "var(--hf-fg)", fontWeight: 600 }}>HALL OF FAME</span>
                <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-fg-dim)" }}>· HIGHEST RATED</span>
              </div>
              <Link href="/backlog?status=BEAT&sort=recent" className="link-hover" style={{ fontSize: 12, color: "var(--hf-violet-soft)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                See all {topRated.length} <ArrowRight size={11} color="var(--hf-violet-soft)" />
              </Link>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
              {topRated.map((row) => (
                <Link key={row.id} href={`/backlog?q=${encodeURIComponent(row.game.title)}`} className="relative cursor-pointer group card-hover" style={{ textDecoration: "none" }}>
                  <GameCover name={row.game.title} coverUrl={row.game.coverUrl} radius={8} />
                  <div
                    className="absolute flex gap-0.5 items-center"
                    style={{
                      top: 5,
                      right: 5,
                      background: "rgba(0,0,0,0.6)",
                      backdropFilter: "blur(4px)",
                      padding: "2px 5px",
                      borderRadius: 999,
                    }}
                  >
                    {Array.from({ length: row.rating ?? 0 }).map((_, j) => (
                      <StarIcon key={j} size={8} color="var(--hf-amber)" />
                    ))}
                    <span className="hf-mono" style={{ fontSize: 9, color: "var(--hf-amber)", marginLeft: 1 }}>{row.rating}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function StatTile({
  label,
  value,
  sub,
  color,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  accent?: string;
}) {
  return (
    <div className="hf-card card-hover p-[18px] relative overflow-hidden flex flex-col justify-between" style={{ minHeight: 130 }}>
      {accent && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 80% 60% at 100% 0%, color-mix(in srgb, ${accent} 10%, transparent) 0%, transparent 60%)` }}
        />
      )}
      <div className="hf-cap relative">{label}</div>
      <div className="relative">
        <div
          style={{
            fontSize: 42,
            fontWeight: 600,
            letterSpacing: "-0.035em",
            lineHeight: 1,
            color: color || "var(--hf-fg)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </div>
        {sub && (
          <div className="hf-mono" style={{ fontSize: 12, color: "var(--hf-fg-muted)", marginTop: 6 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

function NowPlayingHero({
  row,
  achievements,
  compact = false,
}: {
  row: UserGame & { game: Game };
  achievements: AchievementProgress | null;
  compact?: boolean;
}) {
  const game = row.game;
  const playedHrs = row.steamPlaytimeMinutes ? row.steamPlaytimeMinutes / 60 : 0;
  const hltb = game.hltbMainHours;
  const beatProgress = hltb && hltb > 0 ? Math.min(100, (playedHrs / hltb) * 100) : null;
  const achievementPct = achievements && achievements.total > 0 ? (achievements.achieved / achievements.total) * 100 : null;

  const coverW = compact ? 130 : 188;
  const coverH = compact ? 184 : 264;

  return (
    <div
      className="relative overflow-hidden card-hover flex-1"
      style={{
        borderRadius: 20,
        border: "1px solid rgba(34,211,238,0.2)",
        background: "var(--hf-surface)",
        minHeight: 200,
      }}
    >
      {/* Blurred bg art */}
      {game.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={game.coverUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "blur(40px) saturate(1.2)", transform: "scale(1.2)", opacity: 0.5 }}
        />
      )}
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(9,9,11,0.85) 0%, rgba(9,9,11,0.6) 50%, rgba(9,9,11,0.85) 100%)" }} />

      <div className="relative flex flex-col sm:flex-row gap-4 sm:gap-7 p-4 sm:p-[26px]">
        <GameCover name={game.title} coverUrl={game.coverUrl} w={coverW} h={coverH} radius={12} glow />
        <div className="flex-1 flex flex-col justify-between min-w-0 gap-4 sm:gap-0">
          <div>
            <div
              className="inline-flex items-center gap-1.5"
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                background: "var(--hf-cyan-bg)",
                border: "1px solid rgba(34,211,238,0.27)",
              }}
            >
              <span
                className="animate-pulse-glow"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: "var(--hf-cyan)",
                  boxShadow: "0 0 8px var(--hf-cyan)",
                }}
              />
              <span className="hf-mono" style={{ fontSize: 10.5, color: "var(--hf-cyan)", letterSpacing: "0.12em" }}>
                NOW PLAYING
              </span>
            </div>
            <Link href={`/backlog?q=${encodeURIComponent(game.title)}`} style={{ textDecoration: "none", color: "inherit" }}>
              <h2 className="text-[26px] sm:text-[32px] hover:text-violet-400" style={{ fontWeight: 600, letterSpacing: "-0.03em", margin: "10px 0 4px", lineHeight: 1, transition: "color 0.15s ease" }}>
                {game.title}
              </h2>
            </Link>
            <div className="hf-mono" style={{ fontSize: 13, color: "var(--hf-fg-muted)", letterSpacing: "0.02em" }}>
              {playedHrs.toFixed(1)}h played
              {row.lastPlayedAt && ` · last ${row.lastPlayedAt.toLocaleDateString()}`}
              {hltb && hltb > 0 && ` · ~${hltb.toFixed(0)}h to beat`}
            </div>
          </div>

          <div className="flex flex-col gap-3.5 max-w-[580px] mt-6">
            {beatProgress !== null && (
              <div>
                <div className="flex justify-between mb-[7px]">
                  <span className="hf-cap" style={{ color: "var(--hf-cyan)" }}>PROGRESS TO BEAT</span>
                  <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-fg)" }}>{Math.round(beatProgress)}%</span>
                </div>
                <ProgressBar pct={beatProgress} color="var(--hf-cyan)" height={10} />
              </div>
            )}
            {achievementPct !== null && achievements && (
              <div>
                <div className="flex justify-between mb-[7px]">
                  <span className="hf-cap" style={{ color: "var(--hf-amber)" }}>ACHIEVEMENTS</span>
                  <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-fg)" }}>
                    {achievements.achieved} / {achievements.total}
                  </span>
                </div>
                <ProgressBar pct={achievementPct} color="var(--hf-amber)" height={10} />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-row sm:flex-col gap-1.5 sm:items-end justify-end shrink-0">
          <Link href={`/backlog?q=${encodeURIComponent(game.title)}`} className="hf-btn btn-press">Mark beat</Link>
          <Link href={`/backlog?q=${encodeURIComponent(game.title)}`} className="hf-btn hf-btn-ghost btn-press" style={{ fontSize: 12 }}>Pause</Link>
        </div>
      </div>
    </div>
  );
}

function QuickPicks({
  picks,
}: {
  picks: { row: UserGame & { game: Game }; why: string }[];
}) {
  return (
    <div className="hf-card card-hover p-5 flex flex-col">
      <div className="flex justify-between items-center mb-3.5">
        <div className="flex items-center gap-2">
          <SparkleIcon size={14} color="var(--hf-violet-soft)" />
          <span className="hf-cap" style={{ color: "var(--hf-fg)", fontWeight: 600 }}>QUICK PICKS</span>
          <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-fg-dim)" }}>· mini shuffle</span>
        </div>
        <Link
          href="/recommend"
          className="link-hover"
          style={{ fontSize: 12, color: "var(--hf-violet-soft)", display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          Full shuffle <ArrowRight size={11} color="var(--hf-violet-soft)" />
        </Link>
      </div>
      <div className="flex flex-col gap-1">
        {picks.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--hf-fg-dim)" }}>No unplayed games. Add some from the backlog!</p>
        ) : (
          picks.map(({ row, why }, i) => (
            <Link
              key={row.id}
              href={`/backlog?q=${encodeURIComponent(row.game.title)}`}
              className="flex items-center gap-3 row-hover"
              style={{
                padding: "10px 8px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.015)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-fg-dim)", width: 14 }}>{i + 1}</span>
              <GameCover name={row.game.title} coverUrl={row.game.coverUrl} w={42} h={56} radius={6} />
              <div className="flex-1 min-w-0">
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.game.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--hf-fg-muted)", marginTop: 2 }}>{why}</div>
              </div>
              {row.game.hltbMainHours && row.game.hltbMainHours > 0 && (
                <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-fg-dim)" }}>
                  ~{row.game.hltbMainHours.toFixed(0)}h
                </span>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function ByStatus({
  statusCounts,
  total,
}: {
  statusCounts: Record<GameStatus, number>;
  total: number;
}) {
  const data = [
    { label: "Unplayed", n: statusCounts.UNPLAYED, c: "var(--hf-fg-dim)", hex: "#71717a" },
    { label: "Beat", n: statusCounts.BEAT, c: "var(--hf-emerald)", hex: "#10b981" },
    { label: "Wishlist", n: statusCounts.WISHLIST, c: "var(--hf-violet)", hex: "#8b5cf6" },
    { label: "Paused", n: statusCounts.PAUSED, c: "var(--hf-amber)", hex: "#fbbf24" },
    { label: "Playing", n: statusCounts.PLAYING, c: "var(--hf-cyan)", hex: "#22d3ee" },
    { label: "Dropped", n: statusCounts.DROPPED, c: "var(--hf-rose)", hex: "#f43f5e" },
    { label: "Untriaged", n: statusCounts.UNTRIAGED, c: "var(--hf-fg-dim)", hex: "#52525b" },
  ].filter((d) => d.n > 0);

  let cur = 0;
  const stops = data.map((d) => {
    const start = cur;
    cur += (d.n / (total || 1)) * 360;
    return `${d.hex} ${start}deg ${cur}deg`;
  });

  return (
    <div className="hf-card card-hover p-5 flex flex-col">
      <div className="flex justify-between items-center mb-3.5">
        <span className="hf-cap" style={{ color: "var(--hf-fg)", fontWeight: 600 }}>BY STATUS</span>
        <span className="hf-mono" style={{ fontSize: 10.5, color: "var(--hf-fg-dim)" }}>
          SINGLE-PLAYER · {total} GAMES
        </span>
      </div>
      <div className="flex items-center gap-5">
        {/* Donut */}
        <div
          className="shrink-0 relative"
          style={{
            width: 130,
            height: 130,
            borderRadius: 999,
            background: total > 0 ? `conic-gradient(${stops.join(", ")})` : "var(--hf-surface-elev)",
            padding: 16,
          }}
        >
          <div
            className="absolute flex flex-col items-center justify-center"
            style={{
              inset: 16,
              borderRadius: 999,
              background: "var(--hf-surface)",
              border: "1px solid var(--hf-border-soft)",
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1 }}>{total}</div>
            <span className="hf-mono" style={{ fontSize: 9.5, color: "var(--hf-fg-dim)", letterSpacing: "0.1em", marginTop: 2 }}>
              GAMES
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 flex flex-col gap-1.5">
          {data.map((d) => (
            <div key={d.label} className="flex items-center gap-2" style={{ fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: d.hex, flexShrink: 0 }} />
              <span className="flex-1" style={{ color: "var(--hf-fg-muted)", letterSpacing: "-0.005em" }}>{d.label}</span>
              <span className="hf-mono" style={{ fontSize: 12, color: "var(--hf-fg)" }}>{d.n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
