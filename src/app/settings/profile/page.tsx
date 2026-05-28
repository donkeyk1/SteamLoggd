import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { TopNav } from "@/components/ui/top-nav";
import { SignOutButton } from "./sign-out-button";
import { DeleteAccountButton } from "./delete-account-button";
import { UnlinkSteamButton } from "./unlink-steam-button";

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  discord: "Discord",
};

const ALL_OAUTH = ["google", "github", "discord"] as const;

function errorCopy(code: string): string {
  switch (code) {
    case "steam_verify_failed":
      return "Steam sign-in could not be verified. Please try again.";
    case "steam_already_linked":
      return "That Steam account is already linked to a different SteamLoggd account.";
    case "steam_not_linked":
      return "Link your Steam account first.";
    default:
      return "Something went wrong.";
  }
}

function successCopy(code: string): string {
  switch (code) {
    case "steam_linked":
      return "Steam linked! You can now sync your library.";
    case "steam_merged":
      return "Steam linked — your previous backlog has been restored.";
    case "steam_already":
      return "That Steam account is already linked here.";
    default:
      return "Done.";
  }
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await requireSession();
  const { error, success } = await searchParams;

  const [user, accounts] = await Promise.all([
    db.user.findUnique({
      where: { id: session.userId },
      select: { username: true, name: true, email: true },
    }),
    db.account.findMany({
      where: { userId: session.userId },
      select: { provider: true, providerAccountId: true },
      orderBy: { provider: "asc" },
    }),
  ]);

  const linkedProviders = new Set(accounts.map((a) => a.provider));
  const steamAccount = accounts.find((a) => a.provider === "steam");
  const unlinkedOauth = ALL_OAUTH.filter((p) => !linkedProviders.has(p));

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--hf-bg)" }}>
      <TopNav active="dashboard" username={session.username ?? session.name} steamLinked={!!steamAccount} />

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "36px 24px", width: "100%" }}>
        <div style={{ marginBottom: 28 }}>
          <Link href="/dashboard" style={{ fontSize: 13, color: "var(--hf-fg-muted)", textDecoration: "none" }}>
            ← Dashboard
          </Link>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em", margin: "0 0 28px" }}>
          Account
        </h1>

        {/* Banners */}
        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 9, border: "1px solid rgba(244,63,94,0.3)", background: "rgba(244,63,94,0.06)", color: "var(--hf-rose)", fontSize: 13, marginBottom: 16 }}>
            {errorCopy(error)}
          </div>
        )}
        {success && (
          <div style={{ padding: "10px 14px", borderRadius: 9, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.06)", color: "var(--hf-emerald)", fontSize: 13, marginBottom: 16 }}>
            {successCopy(success)}
          </div>
        )}

        <div className="flex flex-col gap-6">
          {/* Profile section */}
          <section>
            <div className="hf-cap" style={{ marginBottom: 14, fontSize: 11 }}>PROFILE</div>
            <div className="flex flex-col gap-4">
              <div>
                <div className="hf-cap" style={{ marginBottom: 6 }}>Username</div>
                <div className="hf-mono" style={{ fontSize: 14 }}>{user?.username ?? "—"}</div>
                <div style={{ fontSize: 11, color: "var(--hf-fg-dim)", marginTop: 4 }}>Permanent — cannot be changed.</div>
              </div>
              {user?.email && (
                <div>
                  <div className="hf-cap" style={{ marginBottom: 6 }}>Email</div>
                  <div style={{ fontSize: 14, color: "var(--hf-fg-muted)" }}>{user.email}</div>
                </div>
              )}
            </div>
          </section>

          <div style={{ borderTop: "1px solid var(--hf-border-soft)" }} />

          {/* Steam section */}
          <section>
            <div className="hf-cap" style={{ marginBottom: 14, fontSize: 11 }}>STEAM</div>
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 11,
                background: "var(--hf-surface)",
                border: "1px solid var(--hf-border-soft)",
              }}
            >
              {steamAccount ? (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--hf-emerald)" }}>Linked</div>
                    <div className="hf-mono" style={{ fontSize: 11, color: "var(--hf-fg-dim)", marginTop: 3 }}>
                      Steam ID: {steamAccount.providerAccountId}
                    </div>
                  </div>
                  <UnlinkSteamButton />
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>Not linked</div>
                    <div style={{ fontSize: 12, color: "var(--hf-fg-muted)", marginTop: 3 }}>
                      Link Steam to sync your library and track playtime.
                    </div>
                  </div>
                  <a
                    href="/api/steam/link/start"
                    className="hf-btn hf-btn-primary"
                    style={{ fontSize: 13, flexShrink: 0 }}
                  >
                    Link Steam
                  </a>
                </div>
              )}
            </div>
          </section>

          <div style={{ borderTop: "1px solid var(--hf-border-soft)" }} />

          {/* Sign-in providers */}
          <section>
            <div className="hf-cap" style={{ marginBottom: 14, fontSize: 11 }}>SIGN-IN PROVIDERS</div>
            <div
              style={{
                borderRadius: 11,
                background: "var(--hf-surface)",
                border: "1px solid var(--hf-border-soft)",
                overflow: "hidden",
              }}
            >
              {ALL_OAUTH.filter((p) => linkedProviders.has(p)).map((p) => (
                <div
                  key={p}
                  className="flex items-center justify-between"
                  style={{ padding: "12px 16px", borderBottom: "1px solid var(--hf-border-soft)" }}
                >
                  <span style={{ fontSize: 14 }}>{PROVIDER_LABELS[p]}</span>
                  <span className="hf-mono" style={{ fontSize: 11, color: "var(--hf-emerald)" }}>Linked</span>
                </div>
              ))}
              {unlinkedOauth.map((p, i) => (
                <div
                  key={p}
                  className="flex items-center justify-between"
                  style={{
                    padding: "12px 16px",
                    borderBottom: i < unlinkedOauth.length - 1 ? "1px solid var(--hf-border-soft)" : "none",
                  }}
                >
                  <span style={{ fontSize: 14, color: "var(--hf-fg-muted)" }}>{PROVIDER_LABELS[p]}</span>
                  <a
                    href={`/api/auth/signin/${p}?callbackUrl=/settings/profile`}
                    style={{ fontSize: 12, color: "var(--hf-violet-soft)" }}
                  >
                    Link
                  </a>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--hf-fg-dim)", marginTop: 8 }}>
              Linking a provider with the same verified email folds it into this account.
            </div>
          </section>

          <div style={{ borderTop: "1px solid var(--hf-border-soft)" }} />

          {/* Sign out */}
          <SignOutButton />

          <div style={{ borderTop: "1px solid var(--hf-border-soft)" }} />

          {/* Danger zone */}
          <section>
            <div className="hf-cap" style={{ marginBottom: 14, fontSize: 11, color: "var(--hf-rose)" }}>DANGER ZONE</div>
            <div
              style={{
                padding: "16px",
                borderRadius: 11,
                background: "rgba(244,63,94,0.04)",
                border: "1px solid rgba(244,63,94,0.15)",
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>Delete account</div>
                  <div style={{ fontSize: 12, color: "var(--hf-fg-muted)", marginTop: 3 }}>
                    Permanently remove your account and all associated data.
                  </div>
                </div>
                <DeleteAccountButton />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
