import { db } from "@/lib/db";

/**
 * Fold a legacy (pre-OAuth) User row into a newly-created OAuth-rooted user.
 *
 * Called from /api/steam/link/callback when the Steam ID a logged-in user
 * just linked matches an existing legacy User row. Moves all backlog data
 * onto the new user and deletes the legacy row.
 *
 * - Keeps the new user's username/email/name (they just signed up with them).
 * - Copies the legacy user's image only if the new user doesn't have one yet
 *   (their OAuth provider's avatar otherwise wins).
 * - Wrapped in a transaction so a partial migration can't strand data.
 */
export async function mergeUser({
  legacyUserId,
  newUserId,
}: {
  legacyUserId: string;
  newUserId: string;
}): Promise<void> {
  if (legacyUserId === newUserId) return;

  await db.$transaction(async (tx) => {
    const [legacy, fresh] = await Promise.all([
      tx.user.findUnique({
        where: { id: legacyUserId },
        select: { image: true },
      }),
      tx.user.findUnique({
        where: { id: newUserId },
        select: { image: true },
      }),
    ]);
    if (!legacy || !fresh) {
      throw new Error("merge_user: source or target user missing");
    }

    await tx.userGame.updateMany({
      where: { userId: legacyUserId },
      data: { userId: newUserId },
    });
    await tx.syncJob.updateMany({
      where: { userId: legacyUserId },
      data: { userId: newUserId },
    });

    if (!fresh.image && legacy.image) {
      await tx.user.update({
        where: { id: newUserId },
        data: { image: legacy.image },
      });
    }

    // Legacy user had a stub Steam Account row pointing to them — cascade
    // delete will remove it along with the user.
    await tx.user.delete({ where: { id: legacyUserId } });
  });
}
