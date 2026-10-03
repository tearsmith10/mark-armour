import type { Metadata } from "next";
import Link from "next/link";
import FaqAccordion from "./FaqAccordion";
import { FAQ_SECTIONS, FAQ_TOTAL } from "./faq-data";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers on ordering, FFL shipping, returns, Stripe payments, 18+ ID verification, accounts and the mark-armour mobile app.",
};

export default function FaqPage() {
  return (
    <div>
      {/* Page header */}
      <section className="border-b border-ink-700 bg-ink-900/40">
        <div className="container-page py-12 lg:py-14">
          <span className="text-[11px] font-bold uppercase tracking-widest text-olive-500">
            Help centre
          </span>
          <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-tight text-stone-100 sm:text-4xl">
            Frequently asked questions
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-stone-500">
            {FAQ_TOTAL} straight answers on ordering, FFL transfers, ID
            verification, payments and everything in between — written by the
            people who pack the boxes.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/contact" className="btn-primary !px-4 !py-2 !text-[11px]">
              Contact us
            </Link>
            <Link href="/shipping" className="btn-ghost !px-4 !py-2 !text-[11px]">
              Shipping & returns
            </Link>
          </div>
        </div>
      </section>

      <div className="container-page grid gap-10 py-12 lg:grid-cols-12">
        {/* Section index */}
        <aside className="hidden lg:col-span-3 lg:block">
          <nav
            aria-label="FAQ sections"
            className="sticky top-28 border-l border-ink-700 pl-5"
          >
            <div className="mb-4 text-[11px] font-bold uppercase tracking-widest text-olive-500">
              Jump to
            </div>
            <ul className="space-y-2.5 text-sm text-stone-500">
              {FAQ_SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="flex items-baseline justify-between gap-3 transition-colors hover:text-blaze-400"
                  >
                    <span>{s.title}</span>
                    <span className="text-[10px] text-stone-600">
                      {s.items.length}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="lg:col-span-9">
          <FaqAccordion sections={FAQ_SECTIONS} />
        </div>
      </div>
    </div>
  );
}
