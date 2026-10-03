import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { initDb, newId } from "@/lib/db";
import type { WeaponRequest } from "@/lib/types";

/**
 * Custom weapon requests — a customer describes what they want when it isn't
 * in the catalog; the description (plus any picture they picked from the live
 * search) is persisted for the armory team to source.
 */
export async function GET() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const db = await initDb();
  const { rows } = await db.query<WeaponRequest>(
    "SELECT * FROM weapon_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
    [user.id],
  );
  return NextResponse.json({ requests: rows });
}

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: {
    description?: string;
    imageUrl?: string;
    imageTitle?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const description = String(body.description ?? "")
    .trim()
    .slice(0, 2000);
  if (description.length < 10) {
    return NextResponse.json(
      { error: "Describe the weapon in at least a sentence (10+ characters)." },
      { status: 400 },
    );
  }

  // Only persist pictures that come from Wikimedia's CDN (defence in depth).
  let imageUrl: string | null = null;
  try {
    const u = new URL(String(body.imageUrl ?? ""));
    if (u.hostname.endsWith(".wikimedia.org") || u.hostname.endsWith("wikipedia.org")) {
      imageUrl = u.href.slice(0, 500);
    }
  } catch {
    imageUrl = null;
  }

  const id = newId();
  const db = await initDb();
  await db.query(
    `INSERT INTO weapon_requests (id, user_id, email, description, image_url, image_title)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      id,
      user.id,
      user.email ?? "",
      description,
      imageUrl,
      String(body.imageTitle ?? "").trim().slice(0, 300) || null,
    ],
  );

  const { rows } = await db.query<WeaponRequest>(
    "SELECT * FROM weapon_requests WHERE id = $1",
    [id],
  );
  return NextResponse.json({ ok: true, request: rows[0] });
}
