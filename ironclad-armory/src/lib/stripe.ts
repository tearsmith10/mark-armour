import type Stripe from "stripe";
import { config } from "./config";
import type { Order, OrderItem } from "./types";

let client: Stripe | null = null;

/** Lazily construct the Stripe client so builds work without a key. */
export async function getStripe(): Promise<Stripe> {
  if (!config.hasStripe) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing)");
  }
  if (!client) {
    const { default: Stripe } = await import("stripe");
    client = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return client;
}

/**
 * Creates a hosted Stripe Checkout Session priced from the DB order.
 * The webhook /api/webhooks/stripe then confirms payment.
 */
export async function createCheckoutSession(
  order: Order,
  items: OrderItem[],
  origin: string,
): Promise<string> {
  const stripe = await getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: order.email,
    line_items: items.map((i) => ({
      quantity: i.quantity,
      price_data: {
        currency: order.currency,
        unit_amount: i.price_cents,
        product_data: { name: i.name, metadata: { order_id: order.id } },
      },
    })),
    ...(order.shipping_cents > 0 && {
      shipping_options: [
        {
          shipping_rate_data: {
            display_name: "Insured shipping",
            type: "fixed_amount",
            fixed_amount: { amount: order.shipping_cents, currency: order.currency },
          },
        },
      ],
    }),
    metadata: { order_id: order.id },
    success_url: `${origin}/orders?session_id={CHECKOUT_SESSION_ID}&status=paid`,
    cancel_url: `${origin}/orders?canceled=${order.id}`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

/** Used by the orders page as a fallback if the webhook hasn't landed yet. */
export async function confirmSessionPaid(sessionId: string): Promise<{
  paid: boolean;
  orderId?: string;
}> {
  const stripe = await getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return {
    paid: session.payment_status === "paid",
    orderId: session.metadata?.order_id,
  };
}
