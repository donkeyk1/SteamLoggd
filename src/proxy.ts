import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const session = req.auth;
  const { pathname } = req.nextUrl;

  // Allowlist: anything that must work pre-onboarding.
  if (
    pathname === "/onboarding" ||
    pathname.startsWith("/api/onboarding") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/auth/logout"
  ) {
    return NextResponse.next();
  }

  // Force signed-in users without a username into the onboarding flow.
  if (session?.user && !session.user.username) {
    const url = req.nextUrl.clone();
    url.pathname = "/onboarding";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

// Don't run middleware on static assets — saves invocations + DB hits.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
