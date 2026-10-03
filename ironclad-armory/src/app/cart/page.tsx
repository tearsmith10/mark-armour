"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { FREE_SHIPPING_THRESHOLD, money, shippingFor } from "@/lib/money";

export default function CartPage() {
  const { items, ready, subtotal, setQty, remove, clear } = useCart();
  const shipping = shippingFor(subtotal);
  const total = subtotal + shipping;
  const missing = FREE_SHIPPING_THRESHOLD - subtotal;

  if (!ready) {
    return (
      <div className="container-page py-20 text-center text-stone-500">Loading cart…</div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container-page py-20">
        <div className="card mx-auto max-w-lg p-12 text-center">
          <div className="text-4xl">🛒</div>
          <h1 className="mt-4 font-display text-2xl font-black uppercase text-stone-100">
            Your cart is empty
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Add a few things from the catalog — your cart is saved to your account when
            you sign in.
          </p>
          <Link href="/products" className="btn-primary mt-6">
            Browse the catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl font-black uppercase tracking-tight text-stone-100">
          Your cart
        </h1>
        <button
          type="button"
          onClick={clear}
          className="text-xs font-bold uppercase tracking-widest text-stone-600 hover:text-red-400"
        >
          Empty cart
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {items.map((line) => (
            <div key={line.slug} className="card flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-olive-500">
                  {line.category}
                </div>
                <Link
                  href={`/products/${line.slug}`}
                  className="font-display font-bold text-stone-100 hover:text-blaze-400"
                >
                  {line.name}
                </Link>
                <div className="mt-1 text-sm text-stone-500">
                  {money(line.price_cents)} each
                </div>
              </div>

              <div className="flex items-center border border-ink-600">
                <button
                  type="button"
                  aria-label="Decrease"
                  onClick={() => setQty(line.slug, line.quantity - 1)}
                  className="px-3 py-2 text-stone-400 hover:text-blaze-400"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-bold text-stone-200">
                  {line.quantity}
                </span>
                <button
                  type="button"
                  aria-label="Increase"
                  onClick={() => setQty(line.slug, line.quantity + 1)}
                  className="px-3 py-2 text-stone-400 hover:text-blaze-400"
                >
                  +
                </button>
              </div>

              <div className="w-24 text-right font-display font-black text-blaze-400">
                {money(line.price_cents * line.quantity)}
              </div>

              <button
                type="button"
                aria-label={`Remove ${line.name}`}
                onClick={() => remove(line.slug)}
                className="text-stone-600 transition-colors hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <aside className="card h-fit p-6">
          <h2 className="font-display text-sm font-black uppercase tracking-widest text-stone-300">
            Order summary
          </h2>

          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">Subtotal</dt>
              <dd className="text-stone-200">{money(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Shipping</dt>
              <dd className={shipping === 0 ? "text-olive-400" : "text-stone-200"}>
                {shipping === 0 ? "FREE" : money(shipping)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-ink-700 pt-3 font-display text-lg font-black">
              <dt className="text-stone-200">Total</dt>
              <dd className="text-blaze-400">{money(total)}</dd>
            </div>
          </dl>

          {shipping > 0 && (
            <p className="mt-3 text-xs leading-relaxed text-olive-600">
              Add {money(missing)} more for free insured shipping.
            </p>
          )}

          <Link href="/checkout" className="btn-primary mt-6 w-full">
            Proceed to checkout
          </Link>
          <p className="mt-3 text-center text-[11px] text-stone-600">
            Prices are re-validated server-side at checkout.
          </p>
        </aside>
      </div>
    </div>
  );
}
