import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description:
    "mark-armour has supplied rifles, pistols, optics and tactical gear to licensed shooters since 1998 — one workshop, one standard, FFL-compliant from bench to transfer.",
};

const VALUES = [
  {
    t: "Compliance first",
    d: "Nothing leaves the building without an 18+ check and a licensed dealer on the other end of the label. When a rule is ambiguous we follow the stricter reading — every time, on every state line.",
  },
  {
    t: "Real photography",
    d: "Every listing is photographed as it sits on our bench. What you see — the finish, the markings, the furniture — is the unit that ships to your dealer. No renders, no borrowed marketing shots.",
  },
  {
    t: "Honest stock",
    d: "Live inventory counts, straight from the database. If the counter says four, four are on the shelf. We would rather lose a sale than take your money for a backorder we cannot fill.",
  },
  {
    t: "Advice over upsell",
    d: "Our armourers will talk you out of the wrong purchase. A $400 optic that suits your use beats a $1,400 one that does not — and you will come back because we said so.",
  },
];

const TEAM = [
  {
    n: "Ray Miller",
    r: "Founder & licensed armourer",
    d: "Opened the original shop in 1998 with a bench, a vice and a hobby that got out of hand. Still heads up custom builds and the distributor relationships.",
  },
  {
    n: "Dana Okafor",
    r: "Head of compliance",
    d: "Keeps every shipment inside federal and state lines — FFL routing, ammunition restrictions and the ID-verification process all run through her checklist.",
  },
  {
    n: "Chris Vance",
    r: "Master gunsmith",
    d: "Twenty years on the lathe. Trigger jobs, headspacing and every one-off build that arrives through the custom request page passes across his bench first.",
  },
  {
    n: "Priya Raman",
    r: "Fulfilment lead",
    d: "Runs the pick-pack bench and the carrier cut-offs. If your tracking label was created before 2pm MT, you have Priya to thank.",
  },
];

export default function AboutPage() {
  return (
    <div>
      {/* Page header */}
      <section className="border-b border-ink-700 bg-ink-900/40">
        <div className="container-page py-12 lg:py-14">
          <span className="text-[11px] font-bold uppercase tracking-widest text-olive-500">
            Since 1998
          </span>
          <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-tight text-stone-100 sm:text-4xl">
            The armory behind mark-armour
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-stone-500">
            A Boise workshop that grew into a nationwide storefront — without
            giving up the habit of inspecting every single item before it ships.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-ink-700">
        <div className="container-page grid grid-cols-2 gap-6 py-8 lg:grid-cols-4">
          {[
            { k: "1998", v: "Year the first bench opened" },
            { k: "27 yrs", v: "Trading without a compliance lapse" },
            { k: "12,400+", v: "Orders shipped to FFL dealers" },
            { k: "4.9★", v: "Average from 2,100 verified reviews" },
          ].map((s) => (
            <div key={s.k}>
              <div className="font-display text-2xl font-black uppercase text-blaze-400 sm:text-3xl">
                {s.k}
              </div>
              <div className="mt-1 text-[11px] uppercase leading-relaxed tracking-widest text-stone-600">
                {s.v}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Story */}
      <section className="container-page grid gap-10 py-14 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h2 className="font-display text-xl font-black uppercase tracking-tight text-stone-100">
            Our story
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-stone-500">
            <p>
              mark-armour started in 1998 as a single workbench in the back of a
              sporting-goods store in Boise, Idaho. Ray Miller was refinishing
              rifles for friends faster than he could sell them, and the
              wait-list for a Miller-tuned carbine eventually outgrew the shop
              that hosted it. The first catalogue was a photocopied sheet handed
              out at the counter; the first “website” was a friend&apos;s
              university hosting space.
            </p>
            <p>
              What has not changed in 27 years is the standard at the bench: if
              we would not run it ourselves, it does not get a listing. Every
              serialized item is function-checked, headspaced where relevant and
              photographed as it actually arrives — which is why our product
              pages show real photographs instead of manufacturer renders.
            </p>
            <p>
              Today the store ships to licensed dealers in 48 states, but the
              dispatch bench still runs on the same rule Ray wrote on the wall in
              1998: <strong className="text-stone-300">verify the person, verify the paperwork, then ship.</strong>{" "}
              Compliance is not a hurdle we clear at checkout — it is the reason
              customers have kept coming back for nearly three decades.
            </p>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="card p-6">
            <h2 className="font-display text-sm font-black uppercase tracking-widest text-stone-300">
              Mission
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-500">
              To give lawful, licensed shooters a store that treats them like
              adults: accurate information, honest stock, real photographs and a
              legal process that never gets in the way of a legitimate purchase.
            </p>
            <h2 className="mt-6 font-display text-sm font-black uppercase tracking-widest text-stone-300">
              Compliance commitment
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-stone-500">
              <li>18+ age gate with document-backed verification on every account.</li>
              <li>
                Serialized items transfer only through a licensed FFL, with the
                dealer logged on the shipping label.
              </li>
              <li>
                ID evidence encrypted, masked at rest and deleted on a short
                retention schedule.
              </li>
              <li>
                Ammunition routed only where caliber, capacity and carrier rules
                allow.
              </li>
            </ul>
            <Link href="/terms" className="btn-ghost mt-6 w-full">
              Read the terms →
            </Link>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-y border-ink-700 bg-ink-900/50">
        <div className="container-page py-14">
          <h2 className="font-display text-xl font-black uppercase tracking-tight text-stone-100">
            What we hold to
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {VALUES.map((v, i) => (
              <div key={v.t} className="card p-6">
                <span className="font-display text-2xl font-black text-blaze-500">
                  0{i + 1}
                </span>
                <h3 className="mt-3 font-display text-sm font-black uppercase tracking-widest text-stone-200">
                  {v.t}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">
                  {v.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team & facility */}
      <section className="container-page py-14">
        <div className="mb-6">
          <h2 className="font-display text-xl font-black uppercase tracking-tight text-stone-100">
            The people at the bench
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-stone-500">
            A small team, deliberately. Every order is picked by someone whose
            name is on this page, from a 6,000 sq ft facility with a climate-controlled
            armoury, a photo bench and a test tunnel two blocks from the
            original 1998 workshop.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map((m) => (
            <div key={m.n} className="card p-5">
              <div className="flex h-12 w-12 items-center justify-center bg-blaze-500 font-display text-lg font-black text-onbrand">
                {m.n
                  .split(" ")
                  .map((p) => p[0])
                  .join("")}
              </div>
              <h3 className="mt-4 font-display text-sm font-black uppercase tracking-widest text-stone-200">
                {m.n}
              </h3>
              <p className="mt-0.5 text-[11px] uppercase tracking-widest text-olive-500">
                {m.r}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-stone-500">{m.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-y border-ink-700 bg-ink-900/50">
        <div className="container-page flex flex-wrap items-center justify-between gap-6 py-10">
          <div className="max-w-2xl">
            <h2 className="font-display text-xl font-black uppercase tracking-tight text-stone-100">
              See it for yourself
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">
              Browse the catalog with live stock, or tell us what you are looking
              for and we will source it.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/products" className="btn-primary">
              Shop the catalog
            </Link>
            <Link href="/contact" className="btn-ghost">
              Talk to us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
