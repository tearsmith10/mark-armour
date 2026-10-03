import { initDb, newId } from "./db";
import { sendOrderConfirmation } from "./mailgun";
import type { Order, OrderItem, Product, Shipping } from "./types";

export async function findOrCreateUser(input: {
  id?: string;
  email: string;
  name?: string | null;
  image?: string | null;
  googleId?: string;
}): Promise<{ id: string; email: string; name: string | null }> {
  const db = await initDb();
  const byEmail = await db.query<{ id: string; email: string; name: string | null }>(
    "SELECT id, email, name FROM users WHERE email = $1",
    [input.email],
  );
  if (byEmail.rows[0]) {
    await db.query(
      "UPDATE users SET name = COALESCE($1, name), image = COALESCE($2, image), google_id = COALESCE($3, google_id) WHERE id = $4",
      [input.name ?? null, input.image ?? null, input.googleId ?? null, byEmail.rows[0].id],
    );
    return byEmail.rows[0];
  }
  const id = input.id ?? newId();
  await db.query(
    "INSERT INTO users (id, google_id, email, name, image) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO NOTHING",
    [id, input.googleId ?? null, input.email, input.name ?? null, input.image ?? null],
  );
  const again = await db.query<{ id: string; email: string; name: string | null }>(
    "SELECT id, email, name FROM users WHERE email = $1",
    [input.email],
  );
  return again.rows[0];
}

export async function getOrder(id: string): Promise<Order | null> {
  const db = await initDb();
  const { rows } = await db.query<Order>("SELECT * FROM orders WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  const db = await initDb();
  const { rows } = await db.query<OrderItem>(
    "SELECT * FROM order_items WHERE order_id = $1",
    [orderId],
  );
  return rows;
}

export async function listOrdersForUser(userId: string): Promise<Order[]> {
  const db = await initDb();
  const { rows } = await db.query<Order>(
    "SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC",
    [userId],
  );
  return rows;
}

export type CreateOrderInput = {
  userId: string;
  email: string;
  products: Product[];
  quantities: Record<string, number>;
  shipping: Shipping;
  provider: "stripe" | "demo";
  stripeSessionId?: string;
  ageVerified: boolean;
  /** Age & identity evidence captured at checkout (already server-validated). */
  verification?: {
    idType: string;
    idNumberMasked: string;
    dob: string;
  };
};

/**
 * Persists the full order (header + line items) in Postgres.
 * Prices are the server-side ones — never what the client sent.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const db = await initDb();
  const id = newId();
  let subtotal = 0;
  for (const p of input.products) subtotal += p.price_cents * input.quantities[p.slug];
  const shipping = subtotal >= 50_000 ? 0 : 1_995;
  const total = subtotal + shipping;

  await db.query(
    `INSERT INTO orders (id, user_id, email, status, subtotal_cents, shipping_cents, total_cents,
       payment_provider, stripe_session_id, full_name, address1, address2, city, postal_code,
       country, phone, age_verified, id_type, id_number_masked, dob)
     VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
    [
      id,
      input.userId,
      input.email,
      subtotal,
      shipping,
      total,
      input.provider,
      input.stripeSessionId ?? null,
      input.shipping.fullName,
      input.shipping.address1,
      input.shipping.address2 || null,
      input.shipping.city,
      input.shipping.postalCode,
      input.shipping.country,
      input.shipping.phone || null,
      input.ageVerified,
      input.verification?.idType ?? null,
      input.verification?.idNumberMasked ?? null,
      input.verification?.dob ?? null,
    ],
  );
  for (const p of input.products) {
    await db.query(
      `INSERT INTO order_items (id, order_id, product_id, name, price_cents, quantity)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [newId(), id, p.id, p.name, p.price_cents, input.quantities[p.slug]],
    );
  }
  return (await getOrder(id))!;
}

/**
 * Marks an order paid exactly once and fires the confirmation email.
 * Safe to call from webhooks / retries thanks to the status + emailed_at guards.
 */
export async function markOrderPaid(
  orderId: string,
  provider: "stripe" | "demo",
  stripeSessionId?: string,
): Promise<{ order: Order | null; alreadyPaid: boolean; emailed: boolean }> {
  const db = await initDb();
  const order = await getOrder(orderId);
  if (!order) return { order: null, alreadyPaid: false, emailed: false };

  let alreadyPaid = order.status === "paid";
  if (!alreadyPaid) {
    const { rows } = await db.query<Order>(
      `UPDATE orders SET status = 'paid', payment_provider = $1, stripe_session_id = COALESCE($2, stripe_session_id)
       WHERE id = $3 AND status <> 'paid'
       RETURNING *`,
      [provider, stripeSessionId ?? null, orderId],
    );
    if (rows[0]) {
      order.status = "paid";
      order.payment_provider = provider;
      // decrement stock exactly once, on the paid transition
      const items = await getOrderItems(orderId);
      for (const it of items) {
        if (it.product_id) {
          await db.query(
            "UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2",
            [it.quantity, it.product_id],
          );
        }
      }
    } else {
      alreadyPaid = true; // lost the race — someone else marked it
    }
  }

  const fresh = (await getOrder(orderId))!;
  if (fresh.status === "paid" && !fresh.emailed_at) {
    const items = await getOrderItems(orderId);
    await sendOrderConfirmation(fresh, items);
    await db.query("UPDATE orders SET emailed_at = NOW() WHERE id = $1 AND emailed_at IS NULL", [
      orderId,
    ]);
    return { order: (await getOrder(orderId))!, alreadyPaid, emailed: true };
  }
  return { order: fresh, alreadyPaid, emailed: false };
}

export async function cancelOrder(orderId: string, userId: string): Promise<void> {
  const db = await initDb();
  await db.query(
    "UPDATE orders SET status = 'canceled' WHERE id = $1 AND user_id = $2 AND status = 'pending'",
    [orderId, userId],
  );
}
