import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "./ContactForm";
import { FAQ_TOTAL } from "@/app/faq/faq-data";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Talk to the mark-armour team — order status, FFL transfers, ID verification, returns and custom builds. One business day response target.",
};

const CHANNELS = [
  {
    t: "Email",
    d: "support@mark-armour.com",
    s: "Replies from a human, not a bot",
  },
  {
    t: "Hours",
    d: "Mon–Fri · 9am–6pm MT",
    s: "Order cut-off 2pm MT · site open 24/7",
  },
  {
    t: "Armory & dispatch",
    d: "Boise, Idaho, USA",
    s: "Address shared with confirmed orders",
  },
  {
    t: "Response time",
    d: "Within 1 business day",
    s: "Verification & shipping issues first",
  },
];

export default function ContactPage() {
  return (
    <div>
      {/* Page header */}
      <section className="border-b border-ink-700 bg-ink-900/40">
        <div className="container-page py-12 lg:py-14">
          <span className="text-[11px] font-bold uppercase tracking-widest text-olive-500">
            Support
          </span>
          <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-tight text-stone-100 sm:text-4xl">
            Talk to the armoury
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-stone-500">
            Order stuck, ID check failed, want a build we don&apos;t list? Write
            it down here — a person on the team reads every message, and
            verification or shipping problems jump the queue.
          </p>
        </div>
      </section>

      <div className="container-page grid gap-10 py-12 lg:grid-cols-12">
        {/* Form */}
        <div className="lg:col-span-7">
          <ContactForm />
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 lg:col-span-5">
          <div className="card p-6">
            <h2 className="font-display text-sm font-black uppercase tracking-widest text-stone-300">
              Other ways to reach us
            </h2>
            <ul className="mt-4 divide-y divide-ink-700">
              {CHANNELS.map((c) => (
                <li key={c.t} className="py-4 first:pt-0 last:pb-0">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-olive-500">
                    {c.t}
                  </div>
                  <div className="mt-1 text-sm font-bold text-stone-200">
                    {c.d}
                  </div>
                  <div className="mt-0.5 text-xs text-stone-600">{c.s}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-6">
            <h2 className="font-display text-sm font-black uppercase tracking-widest text-stone-300">
              Before you write…
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-500">
              The FAQ answers {FAQ_TOTAL} questions on shipping, returns,
              payments, ID verification and accounts — including the ones people
              email us most.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/faq" className="btn-ghost !px-4 !py-2 !text-[11px]">
                Browse the FAQ
              </Link>
              <Link href="/shipping" className="btn-ghost !px-4 !py-2 !text-[11px]">
                Shipping & returns
              </Link>
            </div>
          </div>

          <div className="border border-olive-700 bg-olive-700/10 p-5 text-sm leading-relaxed text-olive-300">
            <strong>Escalation:</strong> if your first reply doesn&apos;t fix
            it, just hit reply and write <strong>escalate</strong> — it goes
            straight to the duty manager the same day.
          </div>
        </aside>
      </div>
    </div>
  );
}
