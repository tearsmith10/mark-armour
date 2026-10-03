import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getOrder, getOrderItems } from "@/lib/orders";
import PayForm from "@/components/PayForm";

export const metadata = { title: "Payment" };

export default async function PayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/checkout/pay/${id}`);

  const order = await getOrder(id);
  if (!order || order.user_id !== user.id) notFound();
  if (order.status === "paid") redirect(`/orders?status=paid`);

  const items = await getOrderItems(order.id);

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <span className="badge bg-blaze-500/15 text-blaze-400">
            Demo payment gateway
          </span>
          <h1 className="mt-3 font-display text-3xl font-black uppercase tracking-tight text-stone-100">
            Complete your payment
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Stripe keys aren&apos;t configured, so this simulated gateway confirms the
            order exactly like a webhook would — order saved, email fired, stock
            decremented.
          </p>
        </div>

        <PayForm
          orderId={order.id}
          subtotal={order.subtotal_cents}
          shipping={order.shipping_cents}
          total={order.total_cents}
          items={items.map((i) => ({
            id: i.id,
            name: i.name,
            price_cents: i.price_cents,
            quantity: i.quantity,
          }))}
        />
      </div>
    </div>
  );
}
