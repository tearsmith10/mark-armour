"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type NavItem = { href: string; label: string };

/**
 * Hamburger + slide-in panel. Everything the desktop header shows (search,
 * nav, app link, account actions) lives here so small screens lose nothing.
 * The panel closes on Escape, overlay click or navigation.
 */
export default function NavbarMobileMenu({
  links,
  signedIn,
  email,
  signOutAction,
}: {
  links: NavItem[];
  signedIn: boolean;
  email: string;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Escape closes and returns focus to the toggle; lock scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>(
      'input, a, button:not([data-close])',
    );
    first?.focus();
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="flex h-9 w-9 items-center justify-center border border-ink-600 text-stone-300 transition-colors hover:border-blaze-500 hover:text-blaze-400 md:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="square"
          aria-hidden="true"
        >
          {open ? (
            <path d="M5 5l14 14M19 5L5 19" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      {open && (
        <div id="mobile-menu" className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-ink-950/85 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col overflow-y-auto border-l border-ink-700 bg-ink-900 shadow-panel"
          >
            <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
              <span className="font-display text-sm font-black uppercase tracking-widest text-stone-200">
                Menu
              </span>
              <button
                type="button"
                data-close
                onClick={() => {
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center border border-ink-600 text-stone-400 transition-colors hover:border-blaze-500 hover:text-blaze-400"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="square"
                  aria-hidden="true"
                >
                  <path d="M5 5l14 14M19 5L5 19" />
                </svg>
              </button>
            </div>

            <form
              action="/products"
              method="get"
              role="search"
              className="border-b border-ink-700 px-5 py-4"
            >
              <label htmlFor="mobile-search" className="sr-only">
                Search the catalog
              </label>
              <input
                id="mobile-search"
                type="search"
                name="q"
                placeholder="Search rifles, optics, ammo…"
                autoComplete="off"
                className="input"
              />
            </form>

            <nav aria-label="Mobile" className="flex flex-col px-5 py-4">
              {links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="border-b border-ink-700 py-3.5 text-sm font-bold uppercase tracking-widest text-stone-300 transition-colors hover:text-blaze-400"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/app"
                onClick={() => setOpen(false)}
                className="border-b border-ink-700 py-3.5 text-sm font-bold uppercase tracking-widest text-blaze-400 transition-colors hover:text-blaze-300"
              >
                Get the app →
              </Link>
            </nav>

            <div className="mt-auto border-t border-ink-700 px-5 py-5">
              {signedIn ? (
                <div className="space-y-3">
                  <p className="truncate text-xs text-stone-500">{email}</p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/orders"
                      onClick={() => setOpen(false)}
                      className="btn-ghost !px-3 !py-2 !text-[11px]"
                    >
                      My orders
                    </Link>
                    <Link
                      href="/cart"
                      onClick={() => setOpen(false)}
                      className="btn-ghost !px-3 !py-2 !text-[11px]"
                    >
                      Cart
                    </Link>
                    <form
                      action={signOutAction}
                      onSubmit={() => setOpen(false)}
                    >
                      <button
                        type="submit"
                        className="btn !border !border-ink-600 !px-3 !py-2 !text-[11px] text-stone-400 hover:!border-blaze-500 hover:text-blaze-400"
                      >
                        Sign out
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-stone-500">
                    18+ · ID verified at checkout
                  </p>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="btn-primary !px-4 !py-2 !text-[11px]"
                  >
                    Sign in
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
