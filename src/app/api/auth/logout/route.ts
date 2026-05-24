import { signOut } from "@/auth";

export async function POST() {
  // signOut() handles cookie clearing + the redirect to "/" for us.
  await signOut({ redirectTo: "/" });
}
