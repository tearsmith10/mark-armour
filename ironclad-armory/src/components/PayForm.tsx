"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/money";

type Item = { id: string; name: string; price_cents: number; quantity: number };

export default function PayForm({
  orderId,
  subtotal,
  shipping,
  total,
  items,
}: {
  orderId: string;
  subtotal: number;
  shipping: number;
  total: number;
  items: Item[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/checkout/${orderId}/pay`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Payment failed.");
        setBusy(false);
        return;
      }
      router.push("/orders?status=paid");
    } catch {
      setError("Network error — please try again.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6">
      <ul className="space-y-3 border-b border-ink-700 pb-5 text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex justify-between gap-3">
            <span className="text-stone-400">
              {i.name} <span className="text-olive-600">× {i.quantity}</span>
            </span>
            <span className="text-stone-200">{money(i.price_cents * i.quantity)}</span>
          </li>
        ))}
      </ul>

      <dl className="space-y-2 border-b border-ink-700 py-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-stone-500">Subtotal</dt>
          <dd>{money(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-stone-500">Shipping</dt>
          <dd>{shipping === 0 ? "FREE" : money(shipping)}</dd>
        </div>
        <div className="flex justify-between font-display text-lg font-black">
          <dt className="text-stone-200">Total charge</dt>
          <dd className="text-blaze-400">{money(total)}</dd>
        </div>
      </dl>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="card">Card number</label>
          <input
            id="card"
            name="card"
            className="input font-mono"
            defaultValue="4242 4242 4242 4242"
            inputMode="numeric"
            autoComplete="cc-number"
          />
        </div>
        <div>
          <label className="label" htmlFor="expiry">Expiry</label>
          <input
            id="expiry"
            name="expiry"
            className="input font-mono"
            defaultValue="12/29"
            autoComplete="cc-exp"
          />
        </div>
        <div>
          <label className="label" htmlFor="cvc">CVC</label>
          <input
            id="cvc"
            name="cvc"
            className="input font-mono"
            defaultValue="123"
            autoComplete="cc-csc"
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button type="submit" disabled={busy} className="btn-primary mt-6 w-full">
        {busy ? "Authorising…" : `Pay ${money(total)}`}
      </button>

      <p className="mt-3 text-center text-[11px] text-stone-600">
        No real charge is made — this gateway simulates Stripe&apos;s confirmation.
      </p>
    </form>
  );
}
