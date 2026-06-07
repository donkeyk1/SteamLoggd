import { Prisma } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { TopNav } from "@/components/ui/top-nav";
import { RecommendClient } from "./recommend-client";

export default async function RecommendPage() {
  const session = await requireSession();

  // Mirror the /api/recommend candidate pool: UNPLAYED/PAUSED + BEAT-wanting-replay.
  // Count single-player and multiplayer separately so the UI can react to the
  // "include multiplayer" toggle without a round-trip.
  const eligibleStatus = {
    OR: [
      { status: { in: ["UNPLAYED", "PAUSED"] } },
      { status: "BEAT", wantReplay: true },
    ],
  } satisfies Prisma.UserGameWhereInput;
  const [baseEligible, multiplayerEligible] = await Promise.all([
    db.userGame.count({ where: { userId: session.userId, isMultiplayer: false, ...eligibleStatus } }),
    db.userGame.count({ where: { userId: session.userId, isMultiplayer: true, ...eligibleStatus } }),
  ]);

  return (
    <main
      className="min-h-screen md:h-screen md:overflow-hidden flex flex-col"
      style={{
        background: "var(--hf-bg)",
        backgroundImage: "radial-gradient(ellipse 50% 40% at 50% 0%, var(--hf-violet-bg) 0%, transparent 70%)",
      }}
    >
      <TopNav active="shuffle" username={session.username ?? session.name} steamLinked={!!session.steamId} />

      <div className="flex-1 flex flex-col px-4 pt-5 pb-24 md:px-10 md:pt-6 md:pb-8 md:min-h-0">
        <RecommendClient baseEligible={baseEligible} multiplayerEligible={multiplayerEligible} />
      </div>
    </main>
  );
}
