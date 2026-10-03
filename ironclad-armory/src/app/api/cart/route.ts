import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { initDb } from "@/lib/db";
import { getProductsBySlugs } from "@/lib/products";

export type CartLine = {
  slug: string;
  name: string;
  category: string;
  price_cents: number;
  stock: number;
  quantity: number;
};

/** GET /api/cart — the signed-in user's persisted cart. */
export async function GET() {
  const user = (await auth())?.user;
  if (!user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const db = await initDb();
  const { rows } = await db.query<{ slug: string; quantity: number }>(
    `SELECT p.slug, c.quantity
     FROM cart_items c JOIN products p ON p.id = c.product_id
     WHERE c.user_id = $1 ORDER BY p.sort_order`,
    [user.id],
  );
  const products = await getProductsBySlugs(rows.map((r) => r.slug));
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const lines: CartLine[] = [];
  for (const r of rows) {
    const p = bySlug.get(r.slug);
    if (!p) continue;
    lines.push({
      slug: p.slug,
      name: p.name,
      category: p.category,
      price_cents: p.price_cents,
      stock: p.stock,
      quantity: r.quantity,
    });
  }
  return NextResponse.json({ items: lines });
}

/** PUT /api/cart — replace the persisted cart (local cart is merged client-side). */
export async function PUT(req: Request) {
  const user = (await auth())?.user;
  if (!user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { items?: { slug?: string; qty?: number }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const items = (body.items ?? [])
    .map((i) => ({ slug: String(i.slug ?? ""), qty: Math.floor(Number(i.qty ?? 0)) }))
    .filter((i) => i.slug && i.qty > 0)
    .slice(0, 50);

  const db = await initDb();
  const products = await getProductsBySlugs(items.map((i) => i.slug));
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  await db.query("DELETE FROM cart_items WHERE user_id = $1", [user.id]);
  for (const item of items) {
    const p = bySlug.get(item.slug);
    if (!p) continue;
    await db.query(
      `INSERT INTO cart_items (user_id, product_id, quantity) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
      [user.id, p.id, Math.min(item.qty, 10)],
    );
  }
  return NextResponse.json({ ok: true, count: items.length });
}
