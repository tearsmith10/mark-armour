import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What mark-armour collects, how ID verification evidence is masked and stored, cookies and localStorage, Stripe payment data, your rights and how to contact us.",
};

const SECTIONS = [
  {
    id: "collect",
    t: "1. Information we collect",
    body: [
      "Account data: your name, email address and either a hashed password or the identifier from your Google/Yahoo sign-in. Optional profile details you add later (shipping state, dealer preference) live in the same record.",
      "Order data: what you bought, order totals, shipping and FFL dealer addresses, and the status history of each order. We keep this for as long as tax and firearm-recordkeeping law requires.",
      "Verification data: the document type you chose (passport, driver’s licence, badge, SSN, national ID/NIN), your full legal name, and a masked representation of the identifier. See section 3 for exactly how the evidence itself is handled.",
      "Technical data: IP address, user agent, referring page and coarse location derived from IP, collected for fraud prevention and to keep the store secure. Theme preference and cart contents are stored locally in your browser (see section 4).",
      "Payment data: we never receive your full card number. Stripe hands us only a payment intent reference, the last four digits, brand and expiry for receipts.",
    ],
  },
  {
    id: "use",
    t: "2. How we use it",
    body: [
      "To process and ship your orders, including the FFL transfer paperwork your dealer is legally required to keep.",
      "To verify you are 18 or older and to satisfy our own compliance obligations under federal and state law.",
      "To send transactional email: order confirmations, tracking, verification requests, password resets and replies from support.",
      "To send marketing email only if you subscribed through the newsletter form — every message carries a one-click unsubscribe, and unsubscribing never affects order email.",
      "To detect fraud, abuse and chargebacks, and to improve the store using aggregated, de-identified statistics.",
    ],
  },
  {
    id: "verification",
    t: "3. ID verification evidence",
    body: [
      "When you upload verification evidence it is encrypted in transit (TLS) and encrypted at rest, and access is limited to the verification team on a least-privilege basis.",
      "What we persist in the database is masked: document type, issuing country/state, the last four characters of the identifier, and a one-way hash used to match future orders. The raw image is reviewed by a human and then deleted on a short retention schedule (no longer than 30 days after approval, or immediately after a failed check you abandon).",
      "We never sell, rent or share verification evidence with advertisers, data brokers or marketing platforms, and it is never attached to your public profile or reviews.",
      "You can request early deletion of your verification evidence at any time through the contact form; deletion does not remove the minimal order records we are required by law to keep.",
    ],
  },
  {
    id: "sharing",
    t: "4. Cookies, localStorage & sharing",
    body: [
      "We use a small number of first-party cookies for the sign-in session. No third-party advertising or cross-site tracking cookies are set by mark-armour.",
      "Your chosen colour theme is stored in your browser’s localStorage under the key mark-armour-theme so the site paints correctly on your next visit, and your cart is cached locally (including in the mobile app shell) so it survives a refresh or a dead signal.",
      "We share data only with the processors needed to run the store: Stripe (payments), our transactional email provider (order and contact mail), the carrier (delivery address and tracking), and our database host. Each is bound by contract to use the data only for that purpose.",
      "We do not sell personal data. Full stop — no exceptions, no “aggregate analytics” carve-outs.",
    ],
  },
  {
    id: "payments",
    t: "5. Payment data",
    body: [
      "Checkout runs in Stripe Checkout over TLS. Card details are tokenised by Stripe (PCI-DSS Level 1) and never touch our servers, logs or database.",
      "We store the Stripe customer/payment reference so receipts, refunds and dispute evidence work; that reference cannot be used to retrieve your card number.",
      "If a payment fails or an order is voided, the associated charge is refunded to the original method and the payment reference is removed from your account on request.",
    ],
  },
  {
    id: "retention",
    t: "6. Retention & deletion",
    body: [
      "Account records: kept while your account is open, then deleted or anonymised within 30 days of a deletion request.",
      "Order and payment records: retained for seven years where required by tax and firearm recordkeeping rules — these contain no ID evidence.",
      "Verification evidence: masked immediately, raw files deleted within 30 days (see section 3).",
      "Support correspondence: kept for two years so we can see what we promised you.",
    ],
  },
  {
    id: "rights",
    t: "7. Your rights",
    body: [
      "Access: ask for a copy of the personal data we hold about you.",
      "Correction: fix anything inaccurate — wrong email, old address, misspelt name.",
      "Erasure: request deletion of everything we are not legally required to keep, including verification evidence.",
      "Restriction & objection: pause processing of marketing data or object to profiling for fraud detection where applicable.",
      "Portability: receive your order history and profile in a machine-readable file.",
      "We answer verified requests within 30 days, usually sooner. Use the contact form with the subject “Privacy request”, and we will confirm identity before releasing or deleting anything.",
    ],
  },
  {
    id: "security",
    t: "8. Security & children",
    body: [
      "The site is served over HTTPS everywhere. Passwords are salted and hashed, sessions are signed, database access is IP-restricted, and staff access to customer data is logged.",
      "No system is perfectly secure: if we ever suffer a breach that affects your data we will notify you by email and describe what happened, what we know was affected, and what we are doing about it.",
      "mark-armour is strictly for people aged 18 and over. We do not knowingly collect data from minors; if you believe a minor has created an account, contact us and we will delete it.",
    ],
  },
  {
    id: "contact",
    t: "9. Changes & contact",
    body: [
      "When this policy changes materially we will note the revision date here and email active accounts before the change takes effect.",
      "Questions, complaints or data requests: use the contact form (subject “Privacy request”), or write to the privacy lead at support@mark-armour.com. If you are unsatisfied with our response you may also lodge a complaint with your state attorney general or the US FTC.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div>
      {/* Page header */}
      <section className="border-b border-ink-700 bg-ink-900/40">
        <div className="container-page py-12 lg:py-14">
          <span className="text-[11px] font-bold uppercase tracking-widest text-olive-500">
            Legal
          </span>
          <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-tight text-stone-100 sm:text-4xl">
            Privacy policy
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-stone-500">
            Plain language, no dark patterns: what we collect, how your ID
            evidence is masked, what Stripe sees, and how to make us delete it.
          </p>
          <p className="mt-4 text-[11px] uppercase tracking-widest text-stone-600">
            Last updated: 1 October 2026
          </p>
        </div>
      </section>

      <div className="container-page grid gap-10 py-12 lg:grid-cols-12">
        <aside className="hidden lg:col-span-3 lg:block">
          <nav
            aria-label="Privacy policy sections"
            className="sticky top-28 border-l border-ink-700 pl-5"
          >
            <div className="mb-4 text-[11px] font-bold uppercase tracking-widest text-olive-500">
              On this page
            </div>
            <ul className="space-y-2.5 text-sm text-stone-500">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="transition-colors hover:text-blaze-400">
                    {s.t}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="max-w-3xl lg:col-span-9">
          <div className="space-y-10">
            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-32">
                <h2 className="font-display text-xl font-black uppercase tracking-tight text-stone-100">
                  {s.t}
                </h2>
                <div className="mt-4 space-y-3 text-sm leading-relaxed text-stone-500">
                  {s.body.map((p) => (
                    <p key={p.slice(0, 40)}>{p}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="card mt-12 flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <h2 className="font-display text-lg font-black uppercase tracking-tight text-stone-100">
                Want your data gone?
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Access, correction and erasure requests are answered within 30
                days.
              </p>
            </div>
            <Link href="/contact" className="btn-primary">
              Make a privacy request
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
