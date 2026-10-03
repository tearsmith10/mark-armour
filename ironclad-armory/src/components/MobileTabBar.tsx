"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./CartProvider";

/** Fixed bottom tab bar — the installed PWA's app chrome (small screens only). */

type IconProps = { className?: string };

function HomeIcon({ className }: IconProps) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

function ShopIcon({ className }: IconProps) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5.5 8h13l-1.1 12.1a1 1 0 0 1-1 .9H7.6a1 1 0 0 1-1-.9L5.5 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </svg>
  );
}

function CartIcon({ className }: IconProps) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 4h2.2l2.3 10.2a1.2 1.2 0 0 0 1.2 1h7.9a1.2 1.2 0 0 0 1.2-.9L18.5 8H6" />
      <circle cx="9.5" cy="19.5" r="1.4" />
      <circle cx="16.5" cy="19.5" r="1.4" />
    </svg>
  );
}

function OrdersIcon({ className }: IconProps) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12v18l-3-1.8L12 21l-3-1.8L6 21V3Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

function AccountIcon({ className }: IconProps) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 21c.6-3.8 3.8-6 7.5-6s6.9 2.2 7.5 6" />
    </svg>
  );
}

export default function MobileTabBar() {
  const pathname = usePathname();
  const { count, ready, signedIn } = useCart();

  const tabs = [
    { href: "/", label: "Home", Icon: HomeIcon },
    { href: "/products", label: "Shop", Icon: ShopIcon },
    { href: "/cart", label: "Cart", Icon: CartIcon, badge: ready ? count : 0 },
    { href: "/orders", label: "Orders", Icon: OrdersIcon },
    { href: signedIn ? "/orders" : "/login", label: "Account", Icon: AccountIcon },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-700 bg-ink-950/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {tabs.map(({ href, label, Icon, badge }) => {
          // When signed in, Account duplicates the Orders destination — let the
          // Orders tab own the active state instead of highlighting both.
          const active =
            label === "Account" ? pathname === "/login" : pathname === href;
          return (
            <li key={label}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  active ? "text-blaze-400" : "text-stone-500 hover:text-stone-300"
                }`}
              >
                <span className="relative">
                  <Icon />
                  {Boolean(badge) && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blaze-500 px-1 text-[9px] font-black leading-none text-onbrand">
                      {badge}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
