import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { searchGames } from "@/lib/igdb/client";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });
  if (q.length > 100) return NextResponse.json({ error: "query_too_long" }, { status: 400 });

  try {
    const results = await searchGames(q);
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
