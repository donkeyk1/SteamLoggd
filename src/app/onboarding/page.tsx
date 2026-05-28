import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { Wordmark } from "@/components/ui/wordmark";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const session = await requireSession();
  if (session.username) redirect("/dashboard");

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center"
      style={{
        background: "var(--hf-bg)",
        backgroundImage:
          "radial-gradient(ellipse 50% 40% at 50% 30%, var(--hf-violet-bg) 0%, transparent 70%)",
      }}
    >
      <div
        className="flex flex-col items-center gap-8 animate-fade"
        style={{ maxWidth: 420, width: "100%", padding: "0 24px" }}
      >
        <Wordmark size={24} />

        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              margin: "0 0 8px",
            }}
          >
            One last step
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--hf-fg-muted)",
              lineHeight: 1.45,
            }}
          >
            Pick a username — this is your permanent handle.
          </p>
        </div>

        <OnboardingForm />
      </div>
    </main>
  );
}
