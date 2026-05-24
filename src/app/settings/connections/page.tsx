import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { UnlinkSteamButton } from "./unlink-button";

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  discord: "Discord",
  steam: "Steam",
};

const ALL_OAUTH = ["google", "github", "discord"] as const;

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await requireSession();
  const { error, success } = await searchParams;

  const accounts = await db.account.findMany({
    where: { userId: session.userId },
    select: { provider: true, providerAccountId: true },
    orderBy: { provider: "asc" },
  });

  const linkedProviders = new Set(accounts.map((a) => a.provider));
  const steamAccount = accounts.find((a) => a.provider === "steam");
  const unlinkedOauth = ALL_OAUTH.filter((p) => !linkedProviders.has(p));

  return (
    <main className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto space-y-6">
        <nav className="text-sm">
          <Link
            href="/dashboard"
            className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            ← Dashboard
          </Link>
        </nav>

        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Connections
        </h1>

        {error && <Banner kind="error">{errorCopy(error)}</Banner>}
        {success && <Banner kind="success">{successCopy(success)}</Banner>}

        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Steam
          </h2>
          <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5">
            {steamAccount ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Linked
                  </p>
                  <p className="text-xs text-zinc-500 font-mono">
                    {steamAccount.providerAccountId}
                  </p>
                </div>
                <UnlinkSteamButton />
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Not linked
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Link Steam to sync your library, fetch achievements, and
                    recover an existing Steamloggd backlog.
                  </p>
                </div>
                <a
                  href="/api/steam/link/start"
                  className="shrink-0 rounded-lg bg-[#171a21] hover:bg-[#2a3441] px-4 py-2 text-sm text-white font-medium transition-colors"
                >
                  Link Steam
                </a>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Sign-in providers
          </h2>
          <ul className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">
            {ALL_OAUTH.filter((p) => linkedProviders.has(p)).map((p) => (
              <li
                key={p}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <span className="text-sm text-zinc-900 dark:text-zinc-100">
                  {PROVIDER_LABELS[p]}
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  Linked
                </span>
              </li>
            ))}
            {unlinkedOauth.map((p) => (
              <li
                key={p}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <span className="text-sm text-zinc-900 dark:text-zinc-100">
                  {PROVIDER_LABELS[p]}
                </span>
                <a
                  href={`/api/auth/signin/${p}?callbackUrl=/settings/connections`}
                  className="text-xs text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Link
                </a>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-zinc-500">
            Linking a new provider with the same verified email folds it into
            this account.
          </p>
        </section>
      </div>
    </main>
  );
}

function Banner({
  kind,
  children,
}: {
  kind: "error" | "success";
  children: React.ReactNode;
}) {
  const style =
    kind === "error"
      ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  return (
    <div className={`rounded-lg border ${style} px-4 py-2 text-sm`}>
      {children}
    </div>
  );
}

function errorCopy(code: string): string {
  switch (code) {
    case "steam_verify_failed":
      return "Steam sign-in could not be verified. Please try again.";
    case "steam_already_linked":
      return "That Steam account is already linked to a different Steamloggd account.";
    case "steam_not_linked":
      return "Link your Steam account first to use this feature.";
    default:
      return "Something went wrong.";
  }
}

function successCopy(code: string): string {
  switch (code) {
    case "steam_linked":
      return "Steam linked. You can now sync your library from the dashboard.";
    case "steam_merged":
      return "Steam linked — your previous backlog has been restored.";
    case "steam_already":
      return "That Steam account is already linked here.";
    default:
      return "Done.";
  }
}
