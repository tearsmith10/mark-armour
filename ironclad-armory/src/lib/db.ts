import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

export type QueryResult<T = Record<string, unknown>> = { rows: T[] };

export interface Db {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
}

/**
 * Database access.
 * - With DATABASE_URL  → Supabase/Neon Postgres via `pg` (production).
 * - Without            → embedded local Postgres (PGlite) persisted to ./.data
 *                       so the store works out of the box. Same SQL either way.
 */
const SCHEMA = /* sql */ `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_id TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  image TEXT,
  password_hash TEXT,
  email_verified_at TIMESTAMPTZ,
  verify_token TEXT,
  verify_expires TIMESTAMPTZ,
  reset_token TEXT,
  reset_expires TIMESTAMPTZ,
  id_type TEXT,
  id_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  caliber TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  badge TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  image_query TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  image_credit TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  subtotal_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  payment_provider TEXT NOT NULL DEFAULT 'demo',
  stripe_session_id TEXT,
  full_name TEXT NOT NULL,
  address1 TEXT NOT NULL,
  address2 TEXT,
  city TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  phone TEXT,
  age_verified BOOLEAN NOT NULL DEFAULT FALSE,
  id_type TEXT,
  id_number_masked TEXT,
  dob DATE,
  emailed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  quantity INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cart_items (
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS weapon_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  image_title TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_requests_user ON weapon_requests (user_id);

-- Migrations for databases created before these columns existed.
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_query TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_credit TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS id_type TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS id_number_masked TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_type TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_hash TEXT;
`;

const g = globalThis as unknown as {
  __armoryDb?: Promise<Db>;
  __armoryReady?: Promise<void>;
};

/**
 * Promise cache that drops rejections — critical during dev hot-reload,
 * where a single failed boot would otherwise poison globalThis forever.
 */
function cached<T>(key: "__armoryDb" | "__armoryReady", factory: () => Promise<T>): Promise<T> {
  const store = globalThis as unknown as Record<string, Promise<T> | undefined>;
  if (!store[key]) store[key] = factory();
  const p = store[key]!;
  p.catch(() => {
    if (store[key] === p) store[key] = undefined;
  });
  return p;
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const { Pool } = await import("pg");
    // Cloud Postgres (Neon/Supabase/RDS) requires TLS even when the URL
    // doesn't spell it out; plain local servers must stay unencrypted.
    const wantsSsl =
      url.includes("sslmode=disable")
        ? false
        : url.includes("sslmode=require") ||
          /\.(neon\.tech|supabase\.(co|com)|rds\.amazonaws\.com)/.test(url);
    const pool = new Pool({
      connectionString: url,
      ssl: wantsSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
    });
    return {
      query: async <T = Record<string, unknown>>(
        text: string,
        params?: unknown[],
      ) => {
        const r = await pool.query(text, params as unknown[]);
        return { rows: r.rows as T[] };
      },
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  // Serverless filesystems are read-only outside /tmp — fall back there on Vercel
  // so the store still boots without DATABASE_URL.
  const dir =
    (process.env.PGLITE_DIR?.trim() ||
      (process.env.VERCEL ? "/tmp/pglite" : "")) ||
    path.join(process.cwd(), ".data", "pglite");
  await mkdir(dir, { recursive: true });
  const pg = new PGlite(dir);
  await pg.waitReady;
  return {
    query: async <T = Record<string, unknown>>(
      text: string,
      params?: unknown[],
    ) => {
      const r = await pg.query(text, params as unknown[]);
      return { rows: r.rows as T[] };
    },
  };
}

export function getDb(): Promise<Db> {
  return cached("__armoryDb", createDb);
}

/** Run schema + seed once per process. */
export async function initDb(): Promise<Db> {
  const db = await getDb();
  await cached("__armoryReady", async () => {
    // Prepared-statement protocols (PGlite) reject multi-command strings —
    // run each statement on its own.
    for (const raw of SCHEMA.split(";")) {
      const stmt = raw.trim();
      if (stmt) await db.query(stmt);
    }

    const { PRODUCT_SEED, PRODUCT_IMAGE_QUERIES } = await import("./catalog");
    const { rows } = await db.query<{ n: string }>(
      "SELECT COUNT(*)::text AS n FROM products",
    );
    if (Number(rows[0]?.n ?? 0) === 0) {
      for (const p of PRODUCT_SEED) {
        await db.query(
          `INSERT INTO products (id, slug, name, category, caliber, description, price_cents, stock, badge, sort_order, image_query)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (slug) DO NOTHING`,
          [
            newId(),
            p.slug,
            p.name,
            p.category,
            p.caliber,
            p.description,
            p.price_cents,
            p.stock,
            p.badge ?? null,
            p.sort_order,
            PRODUCT_IMAGE_QUERIES[p.slug] ?? "",
          ],
        );
      }
    } else {
      // Existing databases: keep image queries (and the rebrand) in sync.
      for (const [slug, query] of Object.entries(PRODUCT_IMAGE_QUERIES)) {
        await db.query(
          "UPDATE products SET image_query = $1 WHERE slug = $2",
          [query, slug],
        );
      }
      await db.query(
        "UPDATE products SET name = 'Mark M1911-A1 .45' WHERE slug = 'ironclad-m1911a1-45' AND name LIKE 'Ironclad%'",
      );
      await db.query(
        "UPDATE products SET description = REPLACE(description, 'the Ironclad lineup', 'the mark-armour lineup') WHERE description LIKE '%the Ironclad lineup%'",
      );
    }
  });
  return db;
}

export const newId = () => randomUUID();
