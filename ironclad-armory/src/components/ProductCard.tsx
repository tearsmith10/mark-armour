import Link from "next/link";
import ProductArt from "./ProductArt";
import type { Product } from "@/lib/types";
import { money } from "@/lib/money";
import AddToCartButton from "./AddToCartButton";

/* eslint-disable @next/next/no-img-element */

export default function ProductCard({
  product,
  index = 0,
}: {
  product: Product;
  index?: number;
}) {
  const soldOut = product.stock <= 0;

  return (
    <div className="group card flex flex-col transition-colors hover:border-ink-600">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-[16/9] overflow-hidden bg-ink-850"
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <ProductArt
            category={product.category}
            seed={index}
            className="transition-transform duration-500 group-hover:scale-105"
          />
        )}
        {product.badge && (
          <span className="badge absolute left-3 top-3 bg-blaze-500 text-onbrand">
            {product.badge}
          </span>
        )}
        {soldOut && (
          <span className="badge absolute right-3 top-3 bg-ink-800 text-stone-400">
            Out of stock
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-olive-500">
          {product.category} · {product.caliber}
        </span>
        <Link
          href={`/products/${product.slug}`}
          className="font-display text-base font-bold text-stone-100 transition-colors group-hover:text-blaze-400"
        >
          {product.name}
        </Link>
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="font-display text-lg font-black text-blaze-400">
            {money(product.price_cents)}
          </span>
          <AddToCartButton
            product={product}
            compact
            disabled={soldOut}
          />
        </div>
      </div>
    </div>
  );
}
