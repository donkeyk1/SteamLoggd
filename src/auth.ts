import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Google({ allowDangerousEmailAccountLinking: true }),
    GitHub({ allowDangerousEmailAccountLinking: true }),
    Discord({ allowDangerousEmailAccountLinking: true }),
  ],
  session: { strategy: "database" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "discord") {
        const verified = (profile as { verified?: boolean } | undefined)?.verified;
        if (!verified) return false;
      }
      return true;
    },
    async session({ session, user }) {
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: {
          username: true,
          accounts: {
            where: { provider: "steam" },
            select: { providerAccountId: true },
            take: 1,
          },
        },
      });
      session.user.id = user.id;
      session.user.username = dbUser?.username ?? null;
      session.user.steamId = dbUser?.accounts[0]?.providerAccountId ?? null;
      return session;
    },
  },
});
