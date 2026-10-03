import Link from "next/link";
import { currentUser, signOut } from "@/lib/auth";
import CartLink from "./CartLink";
import ThemeToggle from "./ThemeToggle";
import NavbarMobileMenu, { type NavItem } from "./NavbarMobileMenu";

/** Real categories only — see src/lib/catalog.ts CATEGORIES. */
const NAV_ITEMS: NavItem[] = [
  { href: "/products", label: "Catalog" },
  { href: "/products?category=Rifles", label: "Rifles" },
  { href: "/products?category=Pistols", label: "Pistols" },
  { href: "/products?category=Ammunition", label: "Ammunition" },
  { href: "/products?category=Optics", label: "Optics" },
  { href: "/custom", label: "Custom" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Support" },
];

const navLinkCls =
  "whitespace-nowrap text-[11px] font-bold uppercase tracking-widest text-stone-400 transition-colors hover:text-blaze-400";

const boxLinkCls =
  "whitespace-nowrap border border-ink-600 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-stone-400 transition-colors hover:border-blaze-500 hover:text-blaze-400";

export default async function Navbar() {
  const user = await currentUser();

  const signOutAction = async () => {
    "use server";
    await signOut({ redirectTo: "/" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink-950/90 backdrop-blur-md">
      {/* Row 1 — brand, search, utilities, account */}
      <div className="container-page flex h-14 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2.5"
            aria-label="mark-armour — home"
          >
            <span className="flex h-9 w-9 items-center justify-center bg-blaze-500 font-black text-onbrand transition-transform group-hover:rotate-6">
              MA
            </span>
            <span className="hidden font-display text-lg font-black uppercase tracking-widest text-stone-100 sm:inline">
              mark<span className="text-blaze-500">-armour</span>
            </span>
          </Link>

          <form
            action="/products"
            method="get"
            role="search"
            className="hidden min-w-0 md:block"
          >
            <label htmlFor="nav-search" className="sr-only">
              Search the catalog
            </label>
            <input
              id="nav-search"
              type="search"
              name="q"
              placeholder="Search…"
              autoComplete="off"
              className="h-9 w-32 border border-ink-600 bg-ink-900 px-3 text-xs text-stone-200 outline-none transition-colors placeholder:text-stone-600 focus:border-blaze-500 lg:w-44 2xl:w-56"
            />
          </form>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <ThemeToggle />
          <CartLink />

          {user ? (
            <div className="hidden items-center gap-2.5 md:flex">
              <span
                className="hidden max-w-[12rem] truncate text-xs text-stone-500 xl:inline"
                title={user.email}
              >
                {user.email}
              </span>
              <Link href="/orders" className={boxLinkCls}>
                My orders
              </Link>
              <form action={signOutAction}>
                <button type="submit" className={boxLinkCls}>
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="btn-primary hidden !px-4 !py-2 !text-[11px] md:inline-flex"
            >
              Sign in
            </Link>
          )}

          <NavbarMobileMenu
            links={NAV_ITEMS}
            signedIn={Boolean(user)}
            email={user?.email ?? ""}
            signOutAction={signOutAction}
          />
        </div>
      </div>

      {/* Row 2 — primary navigation (md and up; hamburger takes over below) */}
      <div className="hidden border-t border-ink-700 md:block">
        <div className="container-page flex h-10 items-center justify-between gap-6">
          <nav
            aria-label="Primary"
            className="flex min-w-0 items-center gap-4 overflow-x-auto [scrollbar-width:none] lg:gap-6 [&::-webkit-scrollbar]:hidden"
          >
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className={navLinkCls}>
                {item.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/app"
            className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[11px] font-bold uppercase tracking-widest text-blaze-400 transition-colors hover:text-blaze-300"
          >
            <span className="hidden lg:inline">Synced web + mobile app</span>
            <span>Get the app →</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
