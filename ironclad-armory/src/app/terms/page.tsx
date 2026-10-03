import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The agreement covering eligibility (18+), lawful purchase, FFL compliance, site use, pricing and errors, returns and limitation of liability.",
};

const SECTIONS = [
  {
    id: "eligibility",
    t: "1. Eligibility & lawful purchase",
    body: [
      "You must be at least 18 years old to create an account or place an order with mark-armour, and by ordering you confirm that you are.",
      "You confirm that your purchase is lawful in your state and municipality — including magazine capacity limits, feature restrictions, caliber bans and any local waiting period or permit requirement.",
      "You are not prohibited from receiving firearms or ammunition under federal or state law (for example due to felony conviction, domestic-violence adjudication, certain misdemeanours, involuntary commitment or active restraining order), and you are not purchasing on behalf of a prohibited person.",
      "We may refuse or cancel any order where we reasonably believe these conditions are not met, and we will refund anything already charged.",
    ],
  },
  {
    id: "verification",
    t: "2. Age & identity verification",
    body: [
      "Before an order ships you must complete identity verification using one accepted document: passport, driver’s licence, law-enforcement/military badge, Social Security number with full legal name, or a national ID (including NIN).",
      "You warrant that the document and name you submit are genuine and yours. Submitting another person’s document, a forged document or a document that does not match your account will result in immediate account termination and, where required, a report to the authorities.",
      "Verification evidence is handled as described in our privacy policy: encrypted, masked at rest, restricted in access and deleted on a short retention schedule.",
    ],
  },
  {
    id: "ffl",
    t: "3. FFL compliance & shipping",
    body: [
      "Firearms and other serialized items may only be shipped to a licensed Federal Firearms License holder nominated by you. Title passes at your receiving dealer, not before.",
      "Your dealer completes the legally required transfer, background check and any state waiting period. Their transfer, logging and handling fees are payable directly to them.",
      "Ammunition and other restricted items ship only where delivery is lawful; orders that would violate state or carrier rules are blocked at checkout or cancelled with a full refund.",
      "Risk of loss passes to you when the carrier records delivery to the nominated dealer or address. Every shipment is insured for full value — if a parcel is lost, you choose replacement or refund.",
    ],
  },
  {
    id: "use",
    t: "4. Acceptable use of the site",
    body: [
      "Use the site only for lawful purposes. Scraping, mass automated ordering, price-siphoning bots, credential stuffing and denial-of-service traffic are prohibited and may result in account termination.",
      "Do not attempt to circumvent age gates, verification, geographic restrictions, purchase limits or checkout logic.",
      "Product reviews and custom-request descriptions must be your own and lawful; we may remove content that is defamatory, obscene, infringing or that reveals another person’s identity.",
      "All site content — copy, photography, logos and the mark-armour name — is our property or licensed to us. You may not reproduce it commercially without written permission.",
    ],
  },
  {
    id: "pricing",
    t: "5. Pricing, availability & errors",
    body: [
      "All prices are in US dollars. Shipping is $19.95 and free when the subtotal reaches $500.00 or more; applicable sales tax is calculated at checkout.",
      "We reserve the right to correct pricing, description or stock errors — including obvious ones such as a $2,000 rifle listed at $20 — at any time before dispatch, and to cancel the affected order with a full refund.",
      "An item in your cart is not reserved until payment is confirmed. If stock sells out before capture, we cancel and refund immediately rather than backorder silently.",
      "Promotional codes are single-use unless stated, cannot be combined unless the offer says so, and have no cash value.",
    ],
  },
  {
    id: "returns",
    t: "6. Returns, refunds & warranty",
    body: [
      "Unopened items in original packaging may be returned within 30 days of delivery; see the shipping & returns page for the full policy, including the FFL-to-FFL requirement for serialized items.",
      "Manufacturer warranties apply to the goods you buy. We administer warranty claims on your behalf during the first year; after that we will still help you start the claim.",
      "Refunds are issued to the original payment method within 1–2 business days of inspecting a return; your bank may take a further 3–10 business days to post it.",
      "Nothing in these terms limits statutory rights that cannot be excluded under applicable consumer law.",
    ],
  },
  {
    id: "liability",
    t: "7. Disclaimers & limitation of liability",
    body: [
      "The site and its content are provided “as is”. We give no warranty that every listing is error-free or available at all times, though we correct inaccuracies promptly.",
      "To the maximum extent permitted by law, mark-armour is not liable for indirect, incidental or consequential damages — lost profits, range time, or damage arising from misuse of a product — arising from your use of the site or the goods.",
      "Our total liability for any claim connected with an order is limited to the amount you paid for that order.",
      "Firearms and ammunition are tools that can cause serious injury or death if mishandled. You are responsible for safe handling, lawful storage and compliance with all instructions and local law; we are not a range safety officer and give no training advice through this site.",
    ],
  },
  {
    id: "law",
    t: "8. Governing law & changes",
    body: [
      "These terms are governed by the laws of the State of Idaho and applicable federal law, without regard to conflict-of-law rules. Disputes are first raised through our support process; if unresolved, they are handled in the courts of Ada County, Idaho.",
      "If any provision here is found unenforceable, the rest stays in effect.",
      "We may update these terms to reflect legal or operational changes; material changes are emailed to active accounts and the revision date at the top of this page is updated. Continued use after that constitutes acceptance.",
      "Questions about these terms: use the contact form — we answer in plain language, not legalese.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div>
      {/* Page header */}
      <section className="border-b border-ink-700 bg-ink-900/40">
        <div className="container-page py-12 lg:py-14">
          <span className="text-[11px] font-bold uppercase tracking-widest text-olive-500">
            Legal
          </span>
          <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-tight text-stone-100 sm:text-4xl">
            Terms of service
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-stone-500">
            The agreement between you and mark-armour — eligibility, lawful
            purchase, FFL compliance, pricing and what happens when something
            goes wrong.
          </p>
          <p className="mt-4 text-[11px] uppercase tracking-widest text-stone-600">
            Last updated: 1 October 2026
          </p>
        </div>
      </section>

      <div className="container-page grid gap-10 py-12 lg:grid-cols-12">
        <aside className="hidden lg:col-span-3 lg:block">
          <nav
            aria-label="Terms sections"
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
                Need this in writing?
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Ask any question about these terms — we reply in plain English
                within one business day.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/contact" className="btn-primary">
                Contact us
              </Link>
              <Link href="/privacy" className="btn-ghost">
                Privacy policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
