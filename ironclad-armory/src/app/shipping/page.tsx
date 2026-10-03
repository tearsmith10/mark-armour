import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Shipping & Returns",
  description:
    "Shipping costs and times, FFL transfer rules, insurance, international restrictions, the 30-day return policy and how refunds are issued.",
};

const METHODS = [
  {
    t: "Standard ground",
    c: "$19.95",
    free: "Free over $500",
    d: "1–3 business days east/central · 2–5 west coast. Insured, signature required.",
  },
  {
    t: "Same-day dispatch",
    c: "Included",
    free: "Cut-off 2pm MT",
    d: "In-stock orders paid before 2pm local time leave the bench the same business day.",
  },
  {
    t: "Expedited 2-day",
    c: "$39.95",
    free: "Shown at checkout",
    d: "Available on in-stock non-hazmat items. Ammunition follows carrier hazmat rules.",
  },
  {
    t: "FFL dealer transfer",
    c: "Free to dealer",
    free: "Dealer fees extra",
    d: "Your dealer may charge a transfer/log fee — we never collect it for them.",
  },
];

const RETURNS = [
  {
    t: "Unopened items",
    d: "Original packaging, unused, within 30 days of delivery → full refund of the item price.",
  },
  {
    t: "Serialized items",
    d: "Returnable when damaged, defective or not as ordered — and always dealer-to-dealer through an FFL.",
  },
  {
    t: "Ammunition",
    d: "Only if the boxes are unopened and factory-sealed, where state law allows the return of ammunition at all.",
  },
  {
    t: "Final sale",
    d: "Custom-built items, clearance lots and hazmat-tagged goods cannot be returned for change of mind.",
  },
];

export default function ShippingPage() {
  return (
    <div>
      {/* Page header */}
      <section className="border-b border-ink-700 bg-ink-900/40">
        <div className="container-page py-12 lg:py-14">
          <span className="text-[11px] font-bold uppercase tracking-widest text-olive-500">
            Logistics
          </span>
          <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-tight text-stone-100 sm:text-4xl">
            Shipping & returns
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-stone-500">
            Flat, honest shipping — free over $500 — insured from our bench to
            your dealer, with a 30-day window to change your mind on unopened
            gear.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/contact" className="btn-primary !px-4 !py-2 !text-[11px]">
              Start a return
            </Link>
            <Link href="/faq" className="btn-ghost !px-4 !py-2 !text-[11px]">
              Shipping FAQ
            </Link>
          </div>
        </div>
      </section>

      {/* Methods */}
      <section className="container-page py-14">
        <h2 className="font-display text-xl font-black uppercase tracking-tight text-stone-100">
          Methods, costs & times
        </h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {METHODS.map((m) => (
            <div key={m.t} className="card flex flex-col p-5">
              <div className="text-[11px] font-bold uppercase tracking-widest text-olive-500">
                {m.t}
              </div>
              <div className="mt-2 font-display text-2xl font-black text-blaze-400">
                {m.c}
              </div>
              <div className="mt-0.5 text-[11px] uppercase tracking-widest text-stone-600">
                {m.free}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-stone-500">{m.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 border border-olive-700 bg-olive-700/10 p-5 text-sm leading-relaxed text-olive-300">
          <strong className="font-bold">Free shipping threshold:</strong> any
          order with a subtotal of <strong>$500.00 or more</strong> ships free
          within the continental US. Below that it is a flat{" "}
          <strong>$19.95</strong> — no per-item handling, no surcharge for rural
          postcodes.
        </div>
      </section>

      {/* FFL */}
      <section className="border-y border-ink-700 bg-ink-900/50">
        <div className="container-page grid gap-10 py-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 className="font-display text-xl font-black uppercase tracking-tight text-stone-100">
              FFL transfers, explained
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-stone-500">
              <p>
                Federal law requires that firearms transfer through a licensed
                Federal Firearms License holder. At checkout you nominate the
                dealer who should receive your order — we insure the parcel to
                their door, they log it into their bound book, run the NICS
                background check when you arrive, and hand it to you.
              </p>
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  Pick your dealer at checkout (or paste the dealer&apos;s FFL
                  details into the order notes).
                </li>
                <li>
                  We ship same-day if you order before 2pm MT, with tracking
                  emailed to you and mirrored in My Orders.
                </li>
                <li>
                  The dealer calls you when the transfer is logged in — bring a
                  government photo ID and pay their transfer fee directly.
                </li>
                <li>
                  You complete the background check and the transfer at their
                  counter. Any state waiting period starts there.
                </li>
              </ol>
              <p>
                Not sure which dealer to use? Send us your postcode through the{" "}
                <Link href="/contact" className="text-blaze-500 hover:text-blaze-400">
                  contact form
                </Link>{" "}
                and we will suggest licensed dealers near you.
              </p>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="card p-6">
              <h3 className="font-display text-sm font-black uppercase tracking-widest text-stone-300">
                Insurance & tracking
              </h3>
              <ul className="mt-3 space-y-3 text-sm leading-relaxed text-stone-500">
                <li>
                  <strong className="text-stone-300">Full-value cover.</strong>{" "}
                  Every parcel is insured for the full invoice value — a lost
                  box is replaced or refunded, your choice.
                </li>
                <li>
                  <strong className="text-stone-300">Signature on delivery.</strong>{" "}
                  Carriers will not leave firearms or high-value parcels without
                  one, including at a dealer.
                </li>
                <li>
                  <strong className="text-stone-300">Tracking everywhere.</strong>{" "}
                  Label notifications go out the moment the label is created;
                  scans mirror into My Orders.
                </li>
                <li>
                  <strong className="text-stone-300">Discreet packaging.</strong>{" "}
                  Plain outer cartons, no branding, no contents declaration on
                  the label.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* International */}
      <section className="container-page py-14">
        <h2 className="font-display text-xl font-black uppercase tracking-tight text-stone-100">
          International restrictions
        </h2>
        <div className="mt-4 grid gap-5 md:grid-cols-3">
          {[
            {
              t: "US only at checkout",
              d: "Standard checkout ships to US addresses only, and serialized items only to licensed US FFL dealers. That includes Alaska and Hawaii on a case-by-case carrier basis.",
            },
            {
              t: "State-level limits",
              d: "Some states restrict magazine capacity, feature sets or specific calibers; others bar ammunition shipping entirely. Checkout blocks combinations that would be illegal to deliver.",
            },
            {
              t: "Canada, UK, Australia",
              d: "Not available through standard checkout. Where local law permits, we quote dealer-to-dealer export paperwork by request — contact us before ordering.",
            },
          ].map((c) => (
            <div key={c.t} className="card p-5">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-olive-500">
                {c.t}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Returns */}
      <section className="border-y border-ink-700 bg-ink-900/50">
        <div className="container-page grid gap-10 py-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 className="font-display text-xl font-black uppercase tracking-tight text-stone-100">
              Returns
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-stone-500">
              <p>
                Changed your mind on unopened gear? You have{" "}
                <strong className="text-stone-300">30 days from delivery</strong>{" "}
                to send it back in original packaging for a refund of the item
                price. Change-of-mind returns on non-serialized items carry a
                flat $9.95 label deduction — everything that arrived damaged,
                defective or wrong ships back on us.
              </p>
              <p>
                Serialized items are the exception: they can be returned when
                they arrive damaged, defective or are not the item ordered, and
                they must travel{" "}
                <strong className="text-stone-300">FFL to FFL</strong>. We
                arrange and pay for that dealer-to-dealer transfer; a genuine
                change of mind on a firearm is handled case by case because of
                the paperwork involved.
              </p>
              <p>
                Ammunition can only be returned if the boxes are unopened,
                factory-sealed, and only where state law permits it.
              </p>
            </div>

            <h3 className="mt-8 font-display text-sm font-black uppercase tracking-widest text-stone-300">
              How to start a return
            </h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-stone-500">
              <li>
                Open the{" "}
                <Link href="/contact" className="text-blaze-500 hover:text-blaze-400">
                  contact form
                </Link>{" "}
                (or reply to your order email) with your order number and what
                you are sending back.
              </li>
              <li>We issue an RMA and a prepaid label within one business day.</li>
              <li>Pack it exactly as it arrived — accessories, manuals, tags.</li>
              <li>
                We inspect within 1–2 business days of delivery and issue the
                refund to your original payment method.
              </li>
            </ol>
          </div>

          <div className="lg:col-span-5">
            <div className="card p-6">
              <h3 className="font-display text-sm font-black uppercase tracking-widest text-stone-300">
                What can go back
              </h3>
              <ul className="mt-4 divide-y divide-ink-700">
                {RETURNS.map((r) => (
                  <li key={r.t} className="py-3 first:pt-0 last:pb-0">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-olive-500">
                      {r.t}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-stone-500">
                      {r.d}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-5 border border-ink-700 bg-ink-950/50 p-4">
                <div className="text-[11px] font-bold uppercase tracking-widest text-stone-300">
                  Refund timeline
                </div>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">
                  Inspection 1–2 business days → refund issued instantly →
                  posted by your bank in 3–10 business days. You get an email at
                  each step.
                </p>
              </div>

              <Link href="/contact" className="btn-primary mt-5 w-full">
                Start a return
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Help */}
      <section className="container-page py-14">
        <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h2 className="font-display text-lg font-black uppercase tracking-tight text-stone-100">
              Delivery problem?
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Tracking frozen, parcel missing, box crushed? Tell us within 48
              hours and we chase the carrier so you don&apos;t have to.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/contact" className="btn-primary">
              Contact us
            </Link>
            <Link href="/faq" className="btn-ghost">
              Read the FAQ
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
