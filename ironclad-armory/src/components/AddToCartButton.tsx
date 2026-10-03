"use client";

import { useState } from "react";
import { useCart, type CartLine } from "./CartProvider";

export default function AddToCartButton({
  product,
  compact = false,
  disabled = false,
}: {
  product: { slug: string; name: string; category: string; price_cents: number };
  compact?: boolean;
  disabled?: boolean;
}) {
  const { add } = useCart();
  const [qty, setQtyState] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    const line: Omit<CartLine, "quantity"> = {
      slug: product.slug,
      name: product.name,
      category: product.category,
      price_cents: product.price_cents,
    };
    add(line, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled}
        className="btn-dark !px-3 !py-2 !text-[10px] hover:!border-blaze-500 hover:!text-blaze-400"
      >
        {added ? "✓ Added" : "+ Add"}
      </button>
    );
  }

  return (
    <div className="flex items-stretch gap-3">
      <div className="flex items-center border border-ink-600">
        <button
          type="button"
          aria-label="Decrease quantity"
          onClick={() => setQtyState((q) => Math.max(1, q - 1))}
          className="px-4 py-3 text-stone-400 hover:text-blaze-400"
        >
          −
        </button>
        <span className="w-8 text-center font-bold text-stone-200">{qty}</span>
        <button
          type="button"
          aria-label="Increase quantity"
          onClick={() => setQtyState((q) => Math.min(10, q + 1))}
          className="px-4 py-3 text-stone-400 hover:text-blaze-400"
        >
          +
        </button>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled}
        className={`flex-1 ${added ? "btn bg-olive-600 text-onbrand" : "btn-primary"}`}
      >
        {disabled ? "Out of stock" : added ? "✓ Added to cart" : "Add to cart"}
      </button>
    </div>
  );
}
