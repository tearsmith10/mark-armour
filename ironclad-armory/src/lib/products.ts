import { initDb } from "./db";
import { bestCommonsImage } from "./wiki";
import type { Product } from "./types";

export async function listProducts(category?: string): Promise<Product[]> {
  const db = await initDb();
  const { rows } = category
    ? await db.query<Product>(
        "SELECT * FROM products WHERE category = $1 ORDER BY sort_order",
        [category],
      )
    : await db.query<Product>("SELECT * FROM products ORDER BY sort_order");
  return rows;
}

/**
 * Lazy real-photo hydration: if a product has no photo yet, fetch one from
 * Wikimedia Commons right now and persist it for every future render.
 */
export async function ensureProductImage(product: Product): Promise<Product> {
  if (product.image_url || !product.image_query) return product;
  const image = await bestCommonsImage(product.image_query);
  if (!image) return product;
  const db = await initDb();
  await db.query(
    "UPDATE products SET image_url = $1, image_credit = $2 WHERE id = $3 AND image_url IS NULL",
    [image.thumb, image.credit, product.id],
  );
  return { ...product, image_url: image.thumb, image_credit: image.credit };
}

export async function getProduct(slug: string): Promise<Product | null> {
  const db = await initDb();
  const { rows } = await db.query<Product>(
    "SELECT * FROM products WHERE slug = $1",
    [slug],
  );
  return rows[0] ?? null;
}

export async function getProductsBySlugs(slugs: string[]): Promise<Product[]> {
  if (slugs.length === 0) return [];
  const db = await initDb();
  const { rows } = await db.query<Product>(
    "SELECT * FROM products WHERE slug = ANY($1::text[])",
    [slugs],
  );
  return rows;
}

export async function categoriesWithCounts(): Promise<
  { category: string; n: number }[]
> {
  const db = await initDb();
  const { rows } = await db.query<{ category: string; n: string }>(
    "SELECT category, COUNT(*)::text AS n FROM products GROUP BY category ORDER BY MIN(sort_order)",
  );
  return rows.map((r) => ({ category: r.category, n: Number(r.n) }));
}
