import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string | null;
      steamId: string | null;
    } & DefaultSession["user"];
  }
}
