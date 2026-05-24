import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const session = await requireSession();
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { username: true, name: true, image: true, email: true },
  });

  return (
    <main className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-md mx-auto space-y-6">
        <nav className="text-sm">
          <Link
            href="/dashboard"
            className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            ← Dashboard
          </Link>
        </nav>

        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Profile
        </h1>

        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Username
          </p>
          <p className="text-sm font-mono text-zinc-900 dark:text-zinc-100">
            {user?.username ?? "—"}
          </p>
          <p className="text-[11px] text-zinc-500">
            Permanent — cannot be changed.
          </p>
        </div>

        {user?.email && (
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Email
            </p>
            <p className="text-sm text-zinc-900 dark:text-zinc-100">
              {user.email}
            </p>
          </div>
        )}

        <ProfileForm
          initialName={user?.name ?? ""}
          initialImage={user?.image ?? ""}
        />
      </div>
    </main>
  );
}
