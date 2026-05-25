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
      <div className="max-w-md text-center animate-in">
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
          className="bg-white hover:bg-zinc-50 text-zinc-900 ring-1 ring-zinc-300 hover:ring-zinc-400 shadow-sm"
          delay="stagger-2"
        />
        <ProviderButton
          provider="github"
          label="Continue with GitHub"
          className="bg-zinc-900 hover:bg-zinc-800 text-white ring-1 ring-zinc-700 hover:ring-zinc-600"
          delay="stagger-3"
        />
        <ProviderButton
          provider="discord"
          label="Continue with Discord"
          className="bg-[#5865F2] hover:bg-[#4752c4] text-white ring-1 ring-[#4752c4] hover:ring-[#3b44a8]"
          delay="stagger-4"
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

const PROVIDER_ICONS: Record<"google" | "github" | "discord", React.ReactNode> = {
  google: (
    <svg className="size-6" viewBox="0 0 48 48">
      <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" fill="#4285F4" />
      <path d="M4.2 14.8l7 5.1C13.3 15.5 18.2 12 24 12c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 15.4 2 8.1 7.3 4.2 14.8z" fill="#EA4335" />
      <path d="M24 46c5.4 0 10.3-1.8 14.1-5l-6.5-5.5C29.5 37.1 26.9 38 24 38c-6 0-11.1-4-12.8-9.5l-7 5.4C8 41 15.3 46 24 46z" fill="#34A853" />
      <path d="M4.2 14.8l7 5.1c-.5 1.3-.7 2.7-.7 4.1s.3 2.8.7 4.1l-7 5.4C2.6 30.5 2 27.4 2 24s.6-6.5 2.2-9.2z" fill="#FBBC05" />
    </svg>
  ),
  github: (
    <svg className="size-6" viewBox="0 0 48 48" fill="currentColor">
      <path d="M24 1A23 23 0 0 0 .7 27.6c0 10.2 6.6 18.8 15.8 21.9 1.2.2 1.6-.5 1.6-1.1v-4.3c-6.4 1.4-7.8-2.7-7.8-2.7-1-2.7-2.6-3.4-2.6-3.4-2.1-1.4.2-1.4.2-1.4 2.3.2 3.5 2.4 3.5 2.4 2.1 3.5 5.4 2.5 6.7 1.9.2-1.5.8-2.5 1.5-3.1-5.1-.6-10.5-2.6-10.5-11.4a9 9 0 0 1 2.4-6.2 8.3 8.3 0 0 1 .2-6.1s2-.6 6.4 2.4a22 22 0 0 1 11.6 0c4.4-3 6.3-2.4 6.3-2.4 1.3 3.2.5 5.5.2 6.1a9 9 0 0 1 2.4 6.2c0 8.9-5.4 10.8-10.6 11.4.8.7 1.6 2.1 1.6 4.3v6.3c0 .6.4 1.4 1.6 1.1A23 23 0 0 0 24 1" />
    </svg>
  ),
  discord: (
    <svg className="size-6" viewBox="0 0 48 48" fill="currentColor">
      <path d="M40 10.5a38.5 38.5 0 0 0-9.6-3 .2.2 0 0 0-.2.1c-.4.8-.9 1.7-1.2 2.5a35.6 35.6 0 0 0-10.7 0A24.6 24.6 0 0 0 17 7.6a.2.2 0 0 0-.2-.1A38.4 38.4 0 0 0 7.3 10.5a.2.2 0 0 0-.1 0C2.2 17.2.7 23.7 1.5 30.2a.2.2 0 0 0 .1.1 39.4 39.4 0 0 0 11.7 5.9.2.2 0 0 0 .2 0 28 28 0 0 0 2.4-3.9.1.1 0 0 0-.1-.2 25 25 0 0 1-3.6-1.7.2.2 0 0 1 0-.3l.7-.5a.1.1 0 0 1 .2 0 27.4 27.4 0 0 0 23.4 0 .1.1 0 0 1 .2 0l.7.5a.2.2 0 0 1 0 .3 24 24 0 0 1-3.7 1.7.1.1 0 0 0 0 .2 27 27 0 0 0 2.4 3.9.2.2 0 0 0 .1 0 39.2 39.2 0 0 0 11.8-5.9.2.2 0 0 0 .1-.1c.9-9.4-1.6-17.5-6.8-24.7a.1.1 0 0 0 0 0zM16 26.6c-2.1 0-3.9-2-3.9-4.3s1.7-4.3 3.9-4.3 3.9 2 3.8 4.3c0 2.4-1.7 4.3-3.8 4.3zm14.2 0c-2.1 0-3.9-2-3.9-4.3s1.7-4.3 3.9-4.3 3.9 2 3.8 4.3c0 2.4-1.7 4.3-3.8 4.3z" />
    </svg>
  ),
};

function ProviderButton({
  provider,
  label,
  className,
  delay,
}: {
  provider: "google" | "github" | "discord";
  label: string;
  className: string;
  delay?: string;
}) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn(provider, { redirectTo: "/onboarding" });
      }}
      className={`animate-in ${delay ?? ""}`}
    >
      <button
        type="submit"
        className={`w-full rounded-lg px-6 py-3 font-medium btn-press flex items-center justify-center gap-3 ${className}`}
      >
        {PROVIDER_ICONS[provider]}
        {label}
      </button>
    </form>
  );
}
