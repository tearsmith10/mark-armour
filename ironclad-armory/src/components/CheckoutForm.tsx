"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { money, shippingFor } from "@/lib/money";
import { ID_TYPES } from "@/lib/types";
import { validateVerification } from "@/lib/verify";

export default function CheckoutForm({
  defaultEmail,
  defaultName,
  provider,
}: {
  defaultEmail: string;
  defaultName: string;
  provider: "stripe" | "demo";
}) {
  const router = useRouter();
  const { items, subtotal } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const shipping = shippingFor(subtotal);
  const total = subtotal + shipping;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const verification = {
      dob: String(fd.get("dob") ?? ""),
      idType: String(fd.get("idType") ?? ""),
      idNumber: String(fd.get("idNumber") ?? ""),
    };

    // Quick local feedback — the API re-validates authoritatively.
    const check = validateVerification(verification);
    if (!check.ok) {
      setError(check.error);
      setSubmitting(false);
      return;
    }
    if (!confirmed) {
      setError("Confirm the 18+ declaration to continue.");
      setSubmitting(false);
      return;
    }

    const payload = {
      items: items.map((l) => ({ slug: l.slug, qty: l.quantity })),
      ageVerified: true,
      verification,
      shipping: {
        fullName: String(fd.get("fullName") ?? ""),
        email: String(fd.get("email") ?? ""),
        address1: String(fd.get("address1") ?? ""),
        address2: String(fd.get("address2") ?? ""),
        city: String(fd.get("city") ?? ""),
        postalCode: String(fd.get("postalCode") ?? ""),
        country: String(fd.get("country") ?? "US"),
        phone: String(fd.get("phone") ?? ""),
      },
    };

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Checkout failed. Please try again.");
        setSubmitting(false);
        if (res.status === 401) router.push("/login?next=/checkout");
        return;
      }
      // Persisted → hand off to Stripe or the demo payment page.
      window.location.href = data.url;
    } catch {
      setError("Network error — please try again.");
      setSubmitting(false);
    }
  };

  if (items.length === 0 && !submitting) {
    return (
      <div className="card p-10 text-center">
        <p className="font-display text-lg font-bold text-stone-300">
          Your cart is empty.
        </p>
        <Link href="/products" className="btn-primary mt-5">
          Browse the catalog
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-5">
      {/* Shipping */}
      <div className="space-y-6 lg:col-span-3">
        <section className="card p-6">
          <h2 className="mb-5 font-display text-sm font-black uppercase tracking-widest text-stone-300">
            1 · Shipping address
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="fullName">Full name</label>
              <input id="fullName" name="fullName" required className="input"
                defaultValue={defaultName} placeholder="John Doe" autoComplete="name" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="email">Email for confirmation</label>
              <input id="email" name="email" type="email" required className="input"
                defaultValue={defaultEmail} placeholder="you@example.com" autoComplete="email" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="address1">Street address</label>
              <input id="address1" name="address1" required className="input"
                placeholder="123 Armory Road" autoComplete="street-address" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="address2">Apartment, suite (optional)</label>
              <input id="address2" name="address2" className="input"
                placeholder="Unit 4B" autoComplete="address-line2" />
            </div>
            <div>
              <label className="label" htmlFor="city">City</label>
              <input id="city" name="city" required className="input"
                placeholder="Springfield" autoComplete="address-level2" />
            </div>
            <div>
              <label className="label" htmlFor="postalCode">Postal code</label>
              <input id="postalCode" name="postalCode" required className="input"
                placeholder="12345" autoComplete="postal-code" />
            </div>
            <div>
              <label className="label" htmlFor="country">Country</label>
              <select id="country" name="country" className="input" defaultValue="US">
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="DE">Germany</option>
                <option value="AU">Australia</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="phone">Phone (optional)</label>
              <input id="phone" name="phone" className="input" placeholder="+1 555 0100"
                autoComplete="tel" />
            </div>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="mb-1 font-display text-sm font-black uppercase tracking-widest text-stone-300">
            2 · Age &amp; identity verification
          </h2>
          <p className="mb-5 text-xs leading-relaxed text-stone-500">
            Buyers must be <strong className="text-stone-300">18 or older</strong>. Provide a
            government-issued document — we record the type and last four characters as
            evidence on your order.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="dob">Date of birth</label>
              <input id="dob" name="dob" type="date" required className="input"
                max={new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <label className="label" htmlFor="idType">Identity document</label>
              <select id="idType" name="idType" required className="input" defaultValue="">
                <option value="" disabled>
                  Select document type…
                </option>
                {ID_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="idNumber">Document number</label>
              <input id="idNumber" name="idNumber" required className="input"
                placeholder="e.g. AB1234567 · 123-45-6789 · Badge #4471" />
              <p className="mt-1.5 text-[11px] text-stone-600">
                Stored as evidence: document type + last four characters only.
              </p>
            </div>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-stone-400">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 h-4 w-4 accent-amber-500"
            />
            <span>
              I confirm the identification details are mine, that I am{" "}
              <strong className="text-stone-200">18 years or older</strong>, and that I am
              legally eligible to purchase firearms and ammunition. Serialized items ship to
              an FFL dealer of my choice for a background check on pickup.
            </span>
          </label>
        </section>

        {error && (
          <div className="border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* Review */}
      <aside className="card h-fit p-6 lg:col-span-2">
        <h2 className="font-display text-sm font-black uppercase tracking-widest text-stone-300">
          Order review
        </h2>

        <ul className="mt-5 max-h-72 space-y-3 overflow-y-auto pr-1 text-sm">
          {items.map((l) => (
            <li key={l.slug} className="flex justify-between gap-3">
              <span className="text-stone-400">
                {l.name}{" "}
                <span className="text-olive-600">× {l.quantity}</span>
              </span>
              <span className="shrink-0 text-stone-200">
                {money(l.price_cents * l.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-5 space-y-3 border-t border-ink-700 pt-4 text-sm">
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

        <button
          type="submit"
          disabled={submitting || items.length === 0}
          className="btn-primary mt-6 w-full"
        >
          {submitting
            ? "Saving order…"
            : provider === "stripe"
              ? `Pay ${money(total)} with Stripe`
              : `Pay ${money(total)}`}
        </button>

        <p className="mt-3 text-center text-[11px] leading-relaxed text-stone-600">
          {provider === "stripe"
            ? "You'll be redirected to Stripe's hosted checkout. The order is saved first, confirmed by webhook."
            : "Stripe keys not configured — a built-in demo payment page will complete the order."}
        </p>
      </aside>
    </form>
  );
}
