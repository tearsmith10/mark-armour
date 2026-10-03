import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { InstallNowButton } from "@/components/InstallPrompt";

export const metadata: Metadata = {
  title: "Get the mobile app",
  description:
    "Install mark-armour on your Android or iPhone — same account and cart as the web, offline browsing, always the latest version. No app store needed.",
};

const STEPS = [
  {
    os: "Android",
    browser: "Chrome",
    steps: [
      "Open mark-armour.vercel.app in Chrome.",
      'Tap the ⋮ menu in the top-right corner.',
      'Choose "Install app" (or "Add to Home screen").',
      'Confirm "Install" — the MA icon lands on your home screen.',
    ],
  },
  {
    os: "iPhone / iPad",
    browser: "Safari",
    steps: [
      "Open mark-armour.vercel.app in Safari.",
      "Tap the Share button (square with the upward arrow).",
      'Scroll down and tap "Add to Home Screen".',
      'Tap "Add" — the app opens full-screen, no browser chrome.',
    ],
  },
];

const FEATURES = [
  "Bottom tab bar: Home, Shop, Cart, Orders and Account — one tap away",
  "Cross-device cart sync: buy on the web, check out on the phone",
  "Offline fallback: cached pages keep working without a signal",
  "Home-screen shortcuts: long-press the icon for Catalog, Cart or Orders",
  "Same sign-in as the web — no extra account, no separate password",
];

export default function AppGuidePage() {
  return (
    <div className="container-page py-12">
      {/* Hero */}
      <div className="card relative overflow-hidden p-8 sm:p-12">
        <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center">
          <Image
            src="/icons/icon-512.png"
            width={112}
            height={112}
            alt="mark-armour app icon"
            className="h-24 w-24 shrink-0 rounded-[22%] sm:h-28 sm:w-28"
            priority
          />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-olive-500">
              Progressive web app · Android &amp; iOS
            </p>
            <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-tight text-stone-100 sm:text-4xl">
              Get the mark-armour <span className="text-blaze-500">mobile app</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-400">
              It&apos;s this exact site — installed on your phone. One account, one cart:
              add a rifle to the cart on your desktop and it appears on your phone in
              seconds. Browse offline, order from anywhere, and never wait for an app
              store update.
            </p>
            <div className="mt-5 flex items-center gap-3 border border-ink-600 bg-ink-950 px-4 py-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
                Install from
              </span>
              <span className="font-display text-sm font-black tracking-wide text-blaze-400 sm:text-base">
                mark-armour.vercel.app
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <InstallNowButton />
          <Link
            href="/products"
            className="text-xs font-bold uppercase tracking-widest text-stone-400 transition-colors hover:text-blaze-400"
          >
            Or keep shopping on the web →
          </Link>
        </div>
      </div>

      {/* Why */}
      <div className="mt-12">
        <h2 className="font-display text-xl font-black uppercase tracking-widest text-stone-100">
          Why install it
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          {[
            {
              t: "Same account, same cart",
              d: "Sign in once — the cart you build on the web shows up on your phone instantly, and changes on the phone flow back the same way.",
            },
            {
              t: "Offline browsing",
              d: "Pages you've visited stay cached, so you can browse the catalog on a dead signal. Your cart is safe either way — it syncs when you're back.",
            },
            {
              t: "Install once",
              d: "No app store, no downloads to approve, no waiting for review. Updates roll out the moment they're live, straight from the site.",
            },
          ].map((f) => (
            <div key={f.t} className="card p-6">
              <div className="mb-3 flex h-9 w-9 items-center justify-center bg-blaze-500 font-black text-onbrand">
                MA
              </div>
              <h3 className="font-display text-sm font-black uppercase tracking-widest text-stone-200">
                {f.t}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">{f.d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Step by step */}
      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        {STEPS.map((s) => (
          <div key={s.os} className="card p-6 sm:p-8">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-lg font-black uppercase tracking-widest text-stone-100">
                {s.os}
              </h2>
              <span className="border border-ink-600 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-olive-400">
                {s.browser}
              </span>
            </div>
            <ol className="mt-5 space-y-4">
              {s.steps.map((step, i) => (
                <li key={step} className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-blaze-500 font-black text-xs text-onbrand">
                    {i + 1}
                  </span>
                  <span className="pt-1 text-sm leading-relaxed text-stone-400">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      {/* Feature list */}
      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        <div className="card p-6 sm:p-8">
          <h2 className="font-display text-lg font-black uppercase tracking-widest text-stone-100">
            In the app
          </h2>
          <ul className="mt-5 space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex gap-3 text-sm leading-relaxed text-stone-400">
                <span className="font-black text-blaze-500" aria-hidden="true">
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="card flex flex-col justify-between p-6 sm:p-8">
          <div>
            <h2 className="font-display text-lg font-black uppercase tracking-widest text-stone-100">
              No app store needed
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-stone-400">
              The mark-armour app works on <strong className="text-stone-200">both Android and iOS</strong> —
              it&apos;s installed straight from the site, so you always run the latest
              version the second we ship it. Nothing to update, nothing to approve,
              and it never disappears from the store.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-stone-400">
              Tip: sign in with the same account on every device — that&apos;s what
              keeps your cart, orders and wishlist in sync across them.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <InstallNowButton />
          </div>
        </div>
      </div>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-ink-700 pt-8">
        <p className="text-xs text-stone-500">
          Installed already? The tab bar at the bottom is your app navigation.
        </p>
        <Link href="/products" className="btn-primary">
          Back to the catalog
        </Link>
      </div>
    </div>
  );
}
