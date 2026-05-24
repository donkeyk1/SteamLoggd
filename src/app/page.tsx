import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session.userId) redirect("/dashboard");

  const { error } = await searchParams;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Game Backlog
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Track what you own, what you&apos;re playing, and what to play next.
        </p>
      </div>

      <a
        href="/api/auth/steam/login"
        className="inline-flex items-center gap-3 rounded-lg bg-[#171a21] hover:bg-[#2a3441] px-6 py-3 text-white font-medium transition-colors"
      >
        Sign in with Steam
      </a>

      {error === "steam_verify_failed" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Steam sign-in could not be verified. Please try again.
        </p>
      )}
    </main>
  );
}
