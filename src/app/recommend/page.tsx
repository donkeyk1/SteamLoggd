import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { RecommendClient } from "./recommend-client";

export default async function RecommendPage() {
  const session = await getSession();
  if (!session.userId) redirect("/");

  return (
    <main className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950">
      <nav className="max-w-2xl mx-auto mb-6 flex items-center gap-4 text-sm">
        <Link
          href="/dashboard"
          className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Dashboard
        </Link>
        <span className="text-zinc-300 dark:text-zinc-700">|</span>
        <span className="font-medium text-zinc-900 dark:text-zinc-50">What to play</span>
      </nav>

      <section className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            What should I play?
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Tell us how much time you have and pick a vibe — we&apos;ll score your
            unplayed and paused games and return the top 3.
          </p>
        </div>

        <RecommendClient />
      </section>
    </main>
  );
}
