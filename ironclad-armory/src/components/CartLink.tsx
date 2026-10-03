"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";

export default function CartLink() {
  const { count, ready } = useCart();

  return (
    <Link
      href="/cart"
      className="relative flex items-center gap-2 border border-ink-600 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-stone-300 transition-colors hover:border-blaze-500 hover:text-blaze-400"
      aria-label={`Cart with ${count} items`}
    >
      🛒 Cart
      {ready && count > 0 && (
        <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center bg-blaze-500 px-1 text-[10px] font-black text-onbrand">
          {count}
        </span>
      )}
    </Link>
  );
}
