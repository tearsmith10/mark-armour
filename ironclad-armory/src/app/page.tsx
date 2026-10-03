import Link from "next/link";
import { categoriesWithCounts, listProducts } from "@/lib/products";
import ProductCard from "@/components/ProductCard";
import NewsletterForm from "@/components/NewsletterForm";
import { CATEGORIES } from "@/lib/catalog";

export const metadata = {
  description:
    "Premium rifles, pistols, shotguns, optics, ammunition and tactical gear since 1998. Real product photography, 18+ ID verification, FFL-compliant shipping and secure Stripe checkout.",
};

const TRUST = [
  {
    t: "18+ ID verified",
    d: "Passport, licence, badge, SSN or national ID",
  },
  {
    t: "Ships to licensed FFL dealers",
    d: "Insured, tracked, signed at transfer",
  },
  {
    t: "Secure Stripe checkout",
    d: "Card data never touches our servers",
  },
  {
    t: "Synced web + mobile app",
    d: "Same cart, account and orders everywhere",
  },
];

const STEPS = [
  {
    n: "01",
    t: "Browse the catalog",
    d: "Real photography, live stock counts and honest specs on every listing — no rendered renders, no guesswork.",
  },
  {
    n: "02",
    t: "Verify your 18+ ID",
    d: "Upload a passport, driver’s licence, badge, SSN or national ID once. Evidence is masked at rest and checked before dispatch.",
  },
  {
    n: "03",
    t: "Pay with Stripe",
    d: "Cards, Apple Pay and Google Pay through Stripe Checkout. You’re charged only when the order is confirmed.",
  },
  {
    n: "04",
    t: "Delivered via FFL",
    d: "Serialized items ship insured to your chosen licensed dealer; the transfer and background check happen there.",
  },
];

const TESTIMONIALS = [
  {
    q: "Ordered a Sentinel MK-15 on Tuesday, the dealer had it Friday. The ID check took two minutes and the tracking emails were spot on.",
    n: "Marcus D.",
    c: "Austin, TX · FFL transfer #4",
  },
  {
    q: "The photos are actual photos of the actual gun. First store online where what I saw in the listing is what arrived.",
    n: "Priya R.",
    c: "Boise, ID · Verified buyer",
  },
  {
    q: "Asked for a custom lever-gun through the request form and got a sourced photo and a quote the same afternoon. Old-school service.",
    n: "Tom W.",
    c: "Nampa, ID · Member since 2011",
  },
];

export default async function HomePage() {
  const [featured, categories] = await Promise.all([
    listProducts(),
    categoriesWithCounts(),
  ]);
  const top = featured.slice(0, 8);

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-b border-ink-700">
        {/* Hero photo: "AKM 1980 assault rifle" by kitmasterbloke · CC BY 2.0
            via Wikimedia Commons — https://commons.wikimedia.org/wiki/File:AKM_1980_assault_rifle.jpg */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/header.jpg"
          alt=""
          aria-hidden="true"
          loading="eager"
          className="absolute inset-0 -z-10 h-full w-full object-cover object-center"
        />
        {/* Theme-aware scrim: opaque on the text side in BOTH themes, photo shows
            through on the right. Text never sits on raw photo pixels. */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink-950 via-ink-950/92 to-ink-950/30" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950/70 via-transparent to-ink-950/30" />

        <div className="container-page py-14 sm:py-20 lg:py-28">
          <div className="max-w-2xl">
            <span className="mb-5 inline-flex w-fit items-center gap-2 border border-olive-700 bg-ink-950/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-olive-400">
              <span className="h-1.5 w-1.5 animate-pulse bg-olive-400" />
              Est. 1998 · FFL Dealer #A1-99273
            </span>

            <h1 className="font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-stone-100 text-balance sm:text-5xl lg:text-6xl">
              Built for the range.
              <span className="block text-blaze-500">Proven in the field.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-stone-400">
              Rifles, pistols, optics and gear — curated, inspected and shipped to
              your preferred FFL. Sign in with Google or Yahoo, check out in
              seconds, and get an instant confirmation in your inbox.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/products" className="btn-primary">
                Shop the catalog
              </Link>
              <Link href="/custom" className="btn-ghost">
                Request a custom build
              </Link>
            </div>

            <p className="mt-6 text-[10px] uppercase tracking-widest text-stone-500">
              Hero photo:{" "}
              <a
                href="https://commons.wikimedia.org/wiki/File:AKM_1980_assault_rifle.jpg"
                target="_blank"
                rel="noreferrer noopener"
                className="underline decoration-dotted underline-offset-2 hover:text-blaze-400"
              >
                “AKM 1980 assault rifle” · kitmasterbloke · CC BY 2.0
              </a>{" "}
              · Wikimedia Commons
            </p>
          </div>
        </div>

        {/* Trust strip — solid, theme-aware background so contrast is guaranteed */}
        <div className="relative border-t border-ink-700 bg-ink-950">
          <div className="container-page grid gap-5 py-5 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map((item) => (
              <div key={item.t} className="flex items-start gap-3">
                <span
                  className="mt-0.5 text-blaze-500"
                  aria-hidden="true"
                >
                  ✦
                </span>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-stone-200">
                    {item.t}
                  </div>
                  <div className="mt-0.5 text-xs text-stone-500">{item.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categories ───────────────────────────────────── */}
      <section className="container-page pt-14">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-black uppercase tracking-tight text-stone-100">
              Shop by category
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Seven departments, one standard — inspected before it ships.
            </p>
          </div>
          <Link
            href="/products"
            className="text-xs font-bold uppercase tracking-widest text-blaze-500 hover:text-blaze-400"
          >
            View all →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/products?category=${encodeURIComponent(c)}`}
              className="card group flex aspect-square flex-col justify-end p-4 transition-all hover:border-blaze-500/60"
            >
              <span className="font-display text-sm font-black uppercase tracking-wider text-stone-300 group-hover:text-blaze-400">
                {c}
              </span>
              <span className="text-[11px] text-stone-600">
                {categories.find((x) => x.category === c)?.n ?? 0} products
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Featured ─────────────────────────────────────── */}
      <section className="container-page py-14">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-black uppercase tracking-tight text-stone-100">
              Featured equipment
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Hand-picked by our armourers — photographed in real life, not rendered.
            </p>
          </div>
          <Link
            href="/products"
            className="text-xs font-bold uppercase tracking-widest text-blaze-500 hover:text-blaze-400"
          >
            View all →
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {top.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section className="border-y border-ink-700 bg-ink-900/50">
        <div className="container-page py-14">
          <h2 className="font-display text-2xl font-black uppercase tracking-tight text-stone-100">
            How it works
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-stone-500">
            From click to counter in four steps — every legal box ticked on the
            way.
          </p>

          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="card p-5">
                <span className="font-display text-2xl font-black text-blaze-500">
                  {s.n}
                </span>
                <h3 className="mt-3 font-display text-sm font-black uppercase tracking-widest text-stone-200">
                  {s.t}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">
                  {s.d}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Custom request ──────────────────────────────── */}
      <section className="border-b border-ink-700 bg-ink-900/50">
        <div className="container-page flex flex-wrap items-center justify-between gap-6 py-10">
          <div className="max-w-2xl">
            <h2 className="font-display text-xl font-black uppercase tracking-tight text-stone-100">
              Can&apos;t find it? Describe it.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">
              Not in the catalog? Write down exactly the weapon you want — the
              live picture search pulls real photographs from the internet so
              there&apos;s no confusion about the item you&apos;re ordering.
            </p>
          </div>
          <Link href="/custom" className="btn-ghost">
            Make a custom request →
          </Link>
        </div>
      </section>

      {/* ── Trust & testimonials ─────────────────────────── */}
      <section className="container-page py-14">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-black uppercase tracking-tight text-stone-100">
              Trusted by 2,100+ shooters
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              4.9★ average across verified purchases — here are three of them.
            </p>
          </div>
          <Link
            href="/about"
            className="text-xs font-bold uppercase tracking-widest text-blaze-500 hover:text-blaze-400"
          >
            Our story →
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.n} className="card flex flex-col p-6">
              <span className="text-xs tracking-widest text-blaze-400" aria-label="5 out of 5 stars">
                ★★★★★
              </span>
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-stone-400">
                “{t.q}”
              </blockquote>
              <figcaption className="mt-4 border-t border-ink-700 pt-4 text-xs text-stone-500">
                <span className="font-bold uppercase tracking-widest text-stone-300">
                  {t.n}
                </span>
                <span className="mt-0.5 block text-stone-600">{t.c}</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-ink-700 pt-8 lg:grid-cols-4">
          {[
            { k: "Since 1998", v: "27 years trading" },
            { k: "24h dispatch", v: "on in-stock orders" },
            { k: "100%", v: "FFL-transfer compliant" },
            { k: "48 states", v: "where law allows" },
          ].map((s) => (
            <div key={s.k}>
              <dt className="font-display text-xl font-black uppercase text-blaze-400">
                {s.k}
              </dt>
              <dd className="mt-1 text-[11px] uppercase tracking-widest text-stone-600">
                {s.v}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Newsletter CTA ───────────────────────────────── */}
      <section className="border-y border-ink-700 bg-ink-900/50">
        <div className="container-page grid gap-6 py-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <h2 className="font-display text-xl font-black uppercase tracking-tight text-stone-100">
              Restocks, drops and range-day deals
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-500">
              One email when something worth shooting lands in stock. Prefer it on
              your phone?{" "}
              <Link href="/app" className="text-blaze-500 hover:text-blaze-400">
                Get the mobile app
              </Link>{" "}
              — your cart and account sync with the web store.
            </p>
          </div>
          <div className="lg:col-span-6">
            <NewsletterForm id="home-newsletter" />
          </div>
        </div>
      </section>
    </div>
  );
}
