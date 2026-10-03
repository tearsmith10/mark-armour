import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { markOrderPaid } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";

/**
 * Stripe webhook — step 5/6/7 of the flow:
 * payment confirmed → order persisted as paid → confirmation email sent.
 */
export async function POST(req: Request) {
  if (!config.hasStripe || !config.hasStripeWebhook) {
    return NextResponse.json({ error: "Stripe webhooks are not configured." }, { status: 400 });
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const payload = await req.text();
  const stripe = await getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.order_id;
    if (orderId) {
      await markOrderPaid(orderId, "stripe", session.id);
    }
  }

  return NextResponse.json({ received: true });
}
