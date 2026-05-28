import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { TopNav } from "@/components/ui/top-nav";
import { RecommendClient } from "./recommend-client";

export default async function RecommendPage() {
  const session = await requireSession();

  const unplayedCount = await db.userGame.count({
    where: { userId: session.userId, isMultiplayer: false, status: { in: ["UNPLAYED", "PAUSED"] } },
  });

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{
        background: "var(--hf-bg)",
        backgroundImage: "radial-gradient(ellipse 50% 40% at 50% 0%, var(--hf-violet-bg) 0%, transparent 70%)",
        overflow: "hidden",
      }}
    >
      <TopNav active="shuffle" username={session.username ?? session.name} steamLinked={!!session.steamId} />

      <div className="flex-1 flex flex-col" style={{ padding: "24px 40px 32px", minHeight: 0 }}>
        <RecommendClient unplayedCount={unplayedCount} />
      </div>
    </main>
  );
}
