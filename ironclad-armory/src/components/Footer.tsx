import Link from "next/link";
import { serviceSummary } from "@/lib/config";
import NewsletterForm from "./NewsletterForm";

/* ── social icons (inline SVG) ─────────────────────────────── */

function SocialIcon({ label, href, children }: { label: string; href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noreferrer noopener"
      className="flex h-9 w-9 items-center justify-center border border-ink-600 text-stone-500 transition-colors hover:border-blaze-500 hover:text-blaze-400"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        {children}
      </svg>
    </a>
  );
}

/* ── payment wordmarks (inline SVG) ────────────────────────── */

function PayBadge({ label, width }: { label: string; width: number }) {
  return (
    <svg
      viewBox={`0 0 ${width} 22`}
      width={width}
      height={22}
      role="img"
      aria-label={label}
      className="text-stone-600"
    >
      <rect
        x="0.5"
        y="0.5"
        width={width - 1}
        height="21"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.55"
      />
      <text
        x={width / 2}
        y="14.5"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="800"
        letterSpacing="0.6"
        fill="currentColor"
      >
        {label}
      </text>
    </svg>
  );
}

function Column({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <div className="mb-4 text-[11px] font-bold uppercase tracking-widest text-olive-500">
        {title}
      </div>
      <ul className="space-y-2 text-sm text-stone-500">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className="transition-colors hover:text-blaze-400">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const svc = serviceSummary();
  const dev = process.env.NODE_ENV !== "production";
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-ink-700 bg-ink-900/60">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-12">
        {/* Brand */}
        <div className="lg:col-span-4">
          <Link href="/" className="group inline-flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center bg-blaze-500 font-black text-onbrand transition-transform group-hover:rotate-6">
              MA
            </span>
            <span className="font-display text-lg font-black uppercase tracking-widest text-stone-100">
              mark<span className="text-blaze-500">-armour</span>
            </span>
          </Link>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-stone-500">
            Premium firearms, optics and tactical gear since 1998. Every serialized
            item is inspected, insured and shipped to a licensed FFL dealer of your
            choice — with 18+ ID verification at checkout.
          </p>
          <div className="mt-5 flex gap-2">
            <SocialIcon label="mark-armour on X" href="#">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
            </SocialIcon>
            <SocialIcon label="mark-armour on YouTube" href="#">
              <path d="M23 7.5s-.22-1.55-.9-2.23c-.85-.87-1.8-.87-2.24-.92C16.7 4.12 12 4.12 12 4.12h-.01s-4.7 0-7.85.23c-.44.05-1.39.05-2.24.92C1.22 5.95 1 7.5 1 7.5S.78 9.32.78 11.15v1.7C.78 14.68 1 16.5 1 16.5s.22 1.55.9 2.23c.85.87 1.97.87 2.47.96 1.8.17 7.63.22 7.63.22s4.7-.01 7.85-.23c.44-.05 1.39-.05 2.24-.92.68-.68.9-2.23.9-2.23s.22-1.82.22-3.65v-1.7C23.22 9.32 23 7.5 23 7.5zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
            </SocialIcon>
            <SocialIcon label="mark-armour on Instagram" href="#">
              <>
                <rect
                  x="2.5"
                  y="2.5"
                  width="19"
                  height="19"
                  rx="5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="4.4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="17.4" cy="6.6" r="1.4" />
              </>
            </SocialIcon>
            <SocialIcon label="mark-armour on Facebook" href="#">
              <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.62c-.3-.04-1.3-.12-2.45-.12-2.42 0-4.08 1.48-4.08 4.2v2.34H7.5V13h2.67v8h3.33z" />
            </SocialIcon>
          </div>
        </div>

        <Column
          title="Shop"
          links={[
            { href: "/products", label: "All products" },
            { href: "/products?category=Rifles", label: "Rifles" },
            { href: "/products?category=Pistols", label: "Pistols" },
            { href: "/products?category=Ammunition", label: "Ammunition" },
            { href: "/products?category=Optics", label: "Optics" },
            { href: "/custom", label: "Custom request" },
          ]}
        />

        <Column
          title="Support"
          links={[
            { href: "/faq", label: "FAQ" },
            { href: "/shipping", label: "Shipping & Returns" },
            { href: "/contact", label: "Contact us" },
            { href: "/orders", label: "My orders" },
            { href: "/login", label: "Track order / Sign in" },
            { href: "/app", label: "Get the mobile app" },
          ]}
        />

        <Column
          title="Company"
          links={[
            { href: "/about", label: "About mark-armour" },
            { href: "/privacy", label: "Privacy policy" },
            { href: "/terms", label: "Terms of service" },
            { href: "/contact", label: "Careers & press" },
          ]}
        />
      </div>

      {/* Newsletter */}
      <div className="border-t border-ink-700">
        <div className="container-page grid gap-6 py-8 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <h3 className="font-display text-sm font-black uppercase tracking-widest text-stone-200">
              Field notes, first looks, restock alerts
            </h3>
            <p className="mt-1 text-sm text-stone-500">
              Join the list for new arrivals and range-day deals. No spam, no
              sharing your address.
            </p>
          </div>
          <div className="lg:col-span-7">
            <NewsletterForm id="footer-newsletter" />
          </div>
        </div>
      </div>

      {/* Compliance */}
      <div className="border-t border-ink-700 bg-ink-950/40">
        <div className="container-page grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              t: "18+ only",
              d: "You must be 18 or older to browse and purchase. Age is confirmed before any order ships.",
            },
            {
              t: "FFL transfer",
              d: "Serialized items ship only to a licensed FFL dealer. Transfer fees at the dealer are paid by you.",
            },
            {
              t: "ID verification",
              d: "Photo ID (passport, driver’s licence, badge, SSN or national ID) is verified at checkout. Evidence is masked at rest.",
            },
            {
              t: "Ammunition laws",
              d: "Ammunition ships only where lawful — some states and carriers restrict caliber, capacity or carrier type.",
            },
          ].map((c) => (
            <div key={c.t}>
              <div className="text-[11px] font-bold uppercase tracking-widest text-olive-500">
                {c.t}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-stone-500">{c.d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-ink-700">
        <div className="container-page flex flex-col gap-4 py-5 text-xs text-stone-600 lg:flex-row lg:items-center lg:justify-between">
          <span>
            © {year} mark-armour — demo storefront. All rights reserved.
          </span>

          <div className="flex flex-wrap items-center gap-2" aria-label="Accepted payment methods">
            <PayBadge label="VISA" width={54} />
            <PayBadge label="MASTERCARD" width={96} />
            <PayBadge label="AMEX" width={56} />
            <PayBadge label="SECURED BY STRIPE" width={134} />
          </div>

          <span>United States · USD ($) · Ships to US FFL dealers</span>
        </div>

        {dev && (
          <div className="container-page pb-5">
            <span className="flex flex-wrap gap-2 font-mono text-[10px] text-stone-600 opacity-70">
              <span className="border border-ink-700 px-2 py-1">db: {svc.database}</span>
              <span className="border border-ink-700 px-2 py-1">auth: {svc.google}</span>
              <span className="border border-ink-700 px-2 py-1">pay: {svc.stripe}</span>
              <span className="border border-ink-700 px-2 py-1">mail: {svc.mailgun}</span>
            </span>
          </div>
        )}
      </div>
    </footer>
  );
}
