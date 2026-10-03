import { NextResponse } from "next/server";
import { searchCommons } from "@/lib/wiki";

/**
 * GET /api/image-search?q=revolver
 * Live picture search over Wikimedia Commons — powers the custom-request
 * page so customers see real photographs of what they're describing.
 */

// naive per-IP budget: 30 searches / minute / instance
const hits = new Map<string, { n: number; windowStart: number }>();
function allow(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart > 60_000) {
    hits.set(ip, { n: 1, windowStart: now });
    if (hits.size > 500) hits.clear();
    return true;
  }
  entry.n += 1;
  return entry.n <= 30;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  if (!allow(ip)) {
    return NextResponse.json({ error: "Too many searches — slow down." }, { status: 429 });
  }
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchCommons(q, 8);
  return NextResponse.json({ results });
}
