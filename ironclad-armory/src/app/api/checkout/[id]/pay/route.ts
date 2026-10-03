import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrder, getOrderItems, markOrderPaid } from "@/lib/orders";

/**
 * Demo payment capture — used only when Stripe is not configured.
 * Stands in for "the payment provider confirms payment" (step 5).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = (await auth())?.user;
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const order = await getOrder(id);
  if (!order || order.user_id !== user.id) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (order.status === "paid") {
    return NextResponse.json({ ok: true, alreadyPaid: true });
  }
  if (order.status !== "pending") {
    return NextResponse.json({ error: `Order is ${order.status}.` }, { status: 409 });
  }

  const items = await getOrderItems(order.id);
  const result = await markOrderPaid(order.id, "demo");
  return NextResponse.json({
    ok: true,
    total: order.total_cents,
    items: items.length,
    emailed: result.emailed,
  });
}
