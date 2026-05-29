import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { enrichUserLibrary } from "@/lib/igdb/enrich";

/**
 * Standalone enrichment pass (IGDB metadata + themes + time-to-beat, and prune
 * of untouched unmatched games). The Steam sync runs the same pipeline inline;
 * this endpoint covers libraries that aren't driven by a Steam sync.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const result = await enrichUserLibrary(session.userId);
  return NextResponse.json(result);
}
