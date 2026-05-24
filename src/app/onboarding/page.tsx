import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const session = await requireSession();
  if (session.username) redirect("/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            One last step
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Pick a username (your permanent handle) and a display name (what
            others see — you can change this later).
          </p>
        </div>
        <OnboardingForm initialDisplayName={session.name ?? ""} />
      </div>
    </main>
  );
}
