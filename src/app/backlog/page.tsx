import Link from "next/link";
import type { GameStatus, Prisma } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { FilterBar } from "./filter-bar";
import { BacklogTable } from "./backlog-table";
import { AddGameForm } from "./add-game-form";

const ALL_STATUSES: GameStatus[] = [
  "WISHLIST",
  "UNTRIAGED",
  "UNPLAYED",
  "PLAYING",
  "PAUSED",
  "BEAT",
  "DROPPED",
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
    // Multiplayer tab shows only MP games; all other tabs hide them
    ...(isMultiplayerView ? { isMultiplayer: true } : { isMultiplayer: false }),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(Object.keys(gameFilter).length > 0 ? { game: gameFilter } : {}),
  };

  const orderBy = SORT_OPTIONS[sort ?? "recent"] ?? SORT_OPTIONS.recent;

  const [games, totalCount, statusCounts, unenrichedCount, multiplayerCount] =
    await Promise.all([
      db.userGame.findMany({ where, include: { game: true }, orderBy, take: 200 }),
      // totalCount = non-multiplayer games
      db.userGame.count({ where: { userId: session.userId, isMultiplayer: false } }),
      // status counts exclude multiplayer games
      db.userGame.groupBy({
        by: ["status"],
        where: { userId: session.userId, isMultiplayer: false },
        _count: { status: true },
      }),
      db.userGame.count({
        where: { userId: session.userId, source: "STEAM", game: { igdbId: null } },
      }),
      db.userGame.count({ where: { userId: session.userId, isMultiplayer: true } }),
    ]);

  const countsByStatus: Record<GameStatus, number> = {
    WISHLIST: 0,
    UNTRIAGED: 0,
    UNPLAYED: 0,
    PLAYING: 0,
    PAUSED: 0,
    BEAT: 0,
    DROPPED: 0,
  };
  for (const row of statusCounts) {
    countsByStatus[row.status] = row._count.status;
  }

  return (
    <main className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950">
      <nav className="max-w-6xl mx-auto mb-6 flex items-center gap-4 text-sm animate-fade">
        <Link
          href="/dashboard"
          className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors"
        >
          ← Dashboard
        </Link>
        <span className="text-zinc-300 dark:text-zinc-700">|</span>
        <span className="font-medium text-zinc-900 dark:text-zinc-50">Backlog</span>
      </nav>

      <section className="max-w-6xl mx-auto space-y-6">
        <div className="animate-in stagger-1">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Backlog
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {totalCount} game{totalCount === 1 ? "" : "s"} total.
          </p>
        </div>

        <div className="animate-in stagger-2">
          <AddGameForm />
        </div>

        <div className="animate-in stagger-3">
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

        <div className="animate-in stagger-4">
        <BacklogTable rows={games} showRemove={isUnenriched} />
        </div>

        {games.length === 200 && (
          <p className="text-xs text-zinc-500">
            Showing first 200. Use filters to narrow down.
          </p>
        )}
      </section>
    </main>
  );
}
