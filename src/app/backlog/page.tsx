import Link from "next/link";
import type { GameStatus, Prisma } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { TopNav } from "@/components/ui/top-nav";
import { DiceIcon, ArrowRight, SyncIcon } from "@/components/ui/icons";
import { FilterBar } from "./filter-bar";
import { BacklogTable } from "./backlog-table";
import { AddGameForm } from "./add-game-form";

const ALL_STATUSES: GameStatus[] = [
  "WISHLIST", "UNTRIAGED", "UNPLAYED", "PLAYING", "PAUSED", "BEAT", "DROPPED",
];

type Search = { status?: string; q?: string; sort?: string };
const UNENRICHED_KEY = "unenriched";
const MULTIPLAYER_KEY = "multiplayer";

const SORT_OPTIONS: Record<string, Prisma.UserGameOrderByWithRelationInput[]> = {
  recent: [{ lastPlayedAt: { sort: "desc", nulls: "last" } }, { steamPlaytime2weeksMinutes: { sort: "desc", nulls: "last" } }, { addedAt: "desc" }, { id: "asc" }],
  playtime: [{ steamPlaytimeMinutes: { sort: "desc", nulls: "last" } }, { id: "asc" }],
  title: [{ game: { title: "asc" } }, { id: "asc" }],
  added: [{ addedAt: "desc" }, { id: "asc" }],
};

export default async function BacklogPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await requireSession();
  const { status, q, sort } = await searchParams;

  const isUnenriched = status === UNENRICHED_KEY;
  const isMultiplayerView = status === MULTIPLAYER_KEY;
  const statusFilter =
    !isUnenriched && !isMultiplayerView && status && ALL_STATUSES.includes(status as GameStatus)
      ? (status as GameStatus)
      : undefined;

  const gameFilter: Prisma.GameWhereInput = {
    ...(isUnenriched ? { igdbId: null } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
  };

  const where: Prisma.UserGameWhereInput = {
    userId: session.userId,
    ...(isMultiplayerView ? { isMultiplayer: true } : { isMultiplayer: false }),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(Object.keys(gameFilter).length > 0 ? { game: gameFilter } : {}),
  };

  const orderBy = SORT_OPTIONS[sort ?? "recent"] ?? SORT_OPTIONS.recent;

  const [games, totalCount, statusCounts, unenrichedCount, multiplayerCount, unplayedCount] =
    await Promise.all([
      db.userGame.findMany({ where, include: { game: true }, orderBy, take: 200 }),
      db.userGame.count({ where: { userId: session.userId, isMultiplayer: false } }),
      db.userGame.groupBy({
        by: ["status"],
        where: { userId: session.userId, isMultiplayer: false },
        _count: { status: true },
      }),
      db.userGame.count({
        where: { userId: session.userId, source: "STEAM", game: { igdbId: null } },
      }),
      db.userGame.count({ where: { userId: session.userId, isMultiplayer: true } }),
      db.userGame.count({ where: { userId: session.userId, isMultiplayer: false, status: "UNPLAYED" } }),
    ]);

  const countsByStatus: Record<GameStatus, number> = {
    WISHLIST: 0, UNTRIAGED: 0, UNPLAYED: 0, PLAYING: 0, PAUSED: 0, BEAT: 0, DROPPED: 0,
  };
  for (const row of statusCounts) {
    countsByStatus[row.status] = row._count.status;
  }

  return (
    <main className="min-h-screen hf-scroll flex flex-col" style={{ background: "var(--hf-bg)", overflow: "hidden" }}>
      <TopNav active="backlog" username={session.username ?? session.name} steamLinked={!!session.steamId} />

      <div className="flex-1 flex flex-col gap-4" style={{ padding: "24px 36px 32px", overflow: "hidden" }}>
        {/* Header */}
        <div className="flex justify-between items-end animate-fade">
          <div>
            <div className="hf-cap" style={{ marginBottom: 4 }}>LIBRARY · STEAM SYNCED</div>
            <h1 className="flex items-baseline gap-3" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.03em", margin: 0 }}>
              Backlog
              <span className="hf-mono" style={{ fontSize: 16, color: "var(--hf-fg-dim)", fontWeight: 400, letterSpacing: "0.02em" }}>
                {totalCount} games
              </span>
            </h1>
          </div>
          <div className="flex gap-2">
            <AddGameForm />
            <Link href="/recommend" className="hf-btn hf-btn-primary btn-press">
              <DiceIcon size={13} /> Shuffle
            </Link>
          </div>
        </div>

        {/* Shuffle callout */}
        {unplayedCount > 0 && (
          <div
            className="relative overflow-hidden animate-in stagger-1"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 20px",
              borderRadius: 14,
              background: "linear-gradient(90deg, var(--hf-violet-bg) 0%, rgba(34,211,238,0.06) 100%)",
              border: "1px solid rgba(139,92,246,0.2)",
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse 30% 100% at 0% 50%, var(--hf-violet-glow) 0%, transparent 60%)" }}
            />
            <div className="flex items-center gap-3.5 relative">
              <div
                className="flex items-center justify-center"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "var(--hf-violet)",
                  boxShadow: "0 4px 24px var(--hf-violet-glow), inset 0 1px 0 rgba(255,255,255,0.2)",
                }}
              >
                <DiceIcon size={20} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.015em" }}>
                  <span style={{ color: "var(--hf-violet-soft)" }}>{unplayedCount} games</span> ready to shuffle
                </div>
                <div style={{ fontSize: 12.5, color: "var(--hf-fg-muted)", marginTop: 2 }}>
                  Let the algorithm pick from your unplayed pile instead of scrolling.
                </div>
              </div>
            </div>
            <Link href="/recommend" className="hf-btn hf-btn-primary btn-press relative">
              <DiceIcon size={13} /> Shuffle unplayed <ArrowRight size={12} color="#fff" />
            </Link>
          </div>
        )}

        {/* Filter bar */}
        <div className="animate-in stagger-2">
          <FilterBar
            activeStatus={statusFilter}
            isUnenriched={isUnenriched}
            isMultiplayerView={isMultiplayerView}
            query={q ?? ""}
            sort={sort ?? "recent"}
            countsByStatus={countsByStatus}
            totalCount={totalCount}
            unenrichedCount={unenrichedCount}
            multiplayerCount={multiplayerCount}
          />
        </div>

        {/* Table */}
        <div className="animate-in stagger-3 flex-1 min-h-0 overflow-hidden">
          <BacklogTable rows={games} showRemove={isUnenriched} />
        </div>

        {games.length === 200 && (
          <p className="hf-mono" style={{ fontSize: 11.5, color: "var(--hf-fg-dim)" }}>
            Showing first 200. Use filters to narrow down.
          </p>
        )}
      </div>
    </main>
  );
}
