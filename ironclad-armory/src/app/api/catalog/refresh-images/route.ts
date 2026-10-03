import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { bestCommonsImage } from "@/lib/wiki";

export const maxDuration = 60;

/**
 * One-shot catalog photo pass: fills products.image_url with a genuine
 * Wikimedia Commons photograph for every product that doesn't have one yet.
 * Pass ?reset=1 to drop all current photos and re-source them (better picks).
 * Requires a signed-in session (so it can't be used as an open proxy).
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const db = await initDb();
  const reset = new URL(req.url).searchParams.get("reset") === "1";
  if (reset) {
    await db.query("UPDATE products SET image_url = NULL, image_credit = NULL");
  }
  const { rows } = await db.query<{ id: string; image_query: string }>(
    "SELECT id, image_query FROM products WHERE image_url IS NULL AND COALESCE(image_query, '') <> '' ORDER BY sort_order",
  );

  let filled = 0;
  const failures: string[] = [];
  for (const row of rows) {
    const image = await bestCommonsImage(row.image_query);
    if (!image) {
      failures.push(row.image_query);
      continue;
    }
    await db.query(
      "UPDATE products SET image_url = $1, image_credit = $2 WHERE id = $3",
      [image.thumb, image.credit, row.id],
    );
    filled += 1;
    // Be polite to the Commons API — avoids burst throttling.
    await new Promise((r) => setTimeout(r, 300));
  }

  return NextResponse.json({ checked: rows.length, filled, failures });
}
