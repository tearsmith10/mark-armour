import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { getOrderItems, listOrdersForUser, markOrderPaid } from "@/lib/orders";
import { money } from "@/lib/money";
import type { Order } from "@/lib/types";
import ClearCartOnPaid from "@/components/ClearCartOnPaid";

export const metadata = { title: "My Orders" };

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-olive-700/40 text-olive-300 border-olive-700",
  pending: "bg-blaze-500/10 text-blaze-400 border-blaze-600/50",
  canceled: "bg-ink-800 text-stone-500 border-ink-600",
  refunded: "bg-ink-800 text-stone-500 border-ink-600",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; canceled?: string; session_id?: string }>;
}) {
  const user = await currentUser();
  const sp = await searchParams;
  if (!user) redirect("/login?next=/orders");

  // Stripe success-redirect fallback: if the webhook hasn't landed yet,
  // confirm the session server-side so the order shows as paid immediately.
  let confirmedNow = false;
  if (sp.session_id && config.hasStripe) {
    try {
      const { confirmSessionPaid } = await import("@/lib/stripe");
      const result = await confirmSessionPaid(sp.session_id);
      if (result.paid && result.orderId) {
        const r = await markOrderPaid(result.orderId, "stripe", sp.session_id);
        confirmedNow = r.emailed;
      }
    } catch (err) {
      console.error("Session confirm failed:", err);
    }
  }

  const orders = await listOrdersForUser(user.id);
  const itemsByOrder = new Map<string, Awaited<ReturnType<typeof getOrderItems>>>();
  for (const o of orders) itemsByOrder.set(o.id, await getOrderItems(o.id));

  return (
    <div className="container-page py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight text-stone-100">
            My orders
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Signed in as <span className="text-olive-400">{user.email}</span> · every
            order below is persisted in Postgres.
          </p>
        </div>
        <Link href="/products" className="btn-ghost">
          Continue shopping
        </Link>
      </div>

      {sp.status === "paid" && (
        <>
          <ClearCartOnPaid />
          <div className="mb-6 border border-olive-700 bg-olive-700/15 p-4 text-sm text-olive-300">
            ✅ Payment confirmed{confirmedNow ? " — your confirmation email is on its way." : "."}
          </div>
        </>
      )}
      {sp.canceled && (
        <div className="mb-6 border border-blaze-600/50 bg-blaze-500/10 p-4 text-sm text-blaze-400">
          Checkout was cancelled — the order is saved as <em>pending</em> and you can
          complete it anytime.
        </div>
      )}

      {orders.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl">📦</div>
          <h2 className="mt-4 font-display text-xl font-black text-stone-200">
            No orders yet
          </h2>
          <p className="mt-2 text-sm text-stone-500">
            Your first order will appear here — with tracking notes and receipts.
          </p>
          <Link href="/products" className="btn-primary mt-6">
            Shop the catalog
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order: Order) => {
            const items = itemsByOrder.get(order.id) ?? [];
            return (
              <article key={order.id} className="card p-6">
                <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-700 pb-4">
                  <div>
                    <div className="font-mono text-xs text-stone-600">
                      #{order.id.slice(0, 8).toUpperCase()} ·{" "}
                      {new Date(order.created_at).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </div>
                    <div className="mt-1 text-sm text-stone-400">
                      {order.full_name} · {order.city}, {order.postal_code}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`badge border ${STATUS_STYLES[order.status] ?? STATUS_STYLES.pending}`}
                    >
                      {order.status}
                    </span>
                    <span className="font-display text-lg font-black text-blaze-400">
                      {money(order.total_cents)}
                    </span>
                  </div>
                </header>

                <ul className="mt-4 space-y-2 text-sm">
                  {items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-3">
                      <span className="text-stone-400">
                        {i.name} <span className="text-olive-600">× {i.quantity}</span>
                      </span>
                      <span className="text-stone-200">
                        {money(i.price_cents * i.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>

                <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-700 pt-4 text-xs text-stone-600">
                  <span>
                    Payment: {order.payment_provider === "stripe" ? "Stripe" : "Demo gateway"}
                    {order.emailed_at
                      ? " · confirmation email sent"
                      : " · email pending"}
                  </span>
                  <span>
                    {order.id_type ? (
                      <span className="text-olive-400">
                        ✓ 18+ verified ·{" "}
                        {
                          {
                            passport: "Passport",
                            drivers_license: "Driver's licence",
                            badge: "Badge",
                            ssn: "SSN",
                            national_id: "National ID",
                          }[order.id_type] ?? order.id_type
                        }{" "}
                        {order.id_number_masked}
                      </span>
                    ) : order.age_verified ? (
                      <span className="text-olive-400">✓ age confirmed</span>
                    ) : null}
                  </span>
                  <span>
                    Ships to {order.address1}, {order.city}
                  </span>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
