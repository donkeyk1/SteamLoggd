import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { getSession } from "@/lib/session";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) {
    redirect(session.username ? "/dashboard" : "/onboarding");
  }

  const { error } = await searchParams;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Steamloggd
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Track what you own, what you&apos;re playing, and what to play next.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <ProviderButton
          provider="google"
          label="Continue with Google"
          className="bg-white hover:bg-zinc-100 text-zinc-900 ring-1 ring-zinc-300"
        />
        <ProviderButton
          provider="github"
          label="Continue with GitHub"
          className="bg-zinc-900 hover:bg-zinc-800 text-white"
        />
        <ProviderButton
          provider="discord"
          label="Continue with Discord"
          className="bg-[#5865F2] hover:bg-[#4752c4] text-white"
        />
      </div>

      {error === "AccessDenied" && (
        <p className="text-sm text-red-600 dark:text-red-400 max-w-sm text-center">
          Sign-in refused. If you used Discord, verify your email there first
          and try again.
        </p>
      )}
    </main>
  );
}

function ProviderButton({
  provider,
  label,
  className,
}: {
  provider: "google" | "github" | "discord";
  label: string;
  className: string;
}) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn(provider, { redirectTo: "/onboarding" });
      }}
    >
      <button
        type="submit"
        className={`w-full rounded-lg px-6 py-3 font-medium transition-colors ${className}`}
      >
        {label}
      </button>
    </form>
  );
}
