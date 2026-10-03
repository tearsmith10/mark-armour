"use client";

import { useEffect } from "react";
import { useCart } from "./CartProvider";

/** Empty the cart the moment an order is confirmed (demo AND Stripe flows). */
export default function ClearCartOnPaid() {
  const { clear, ready } = useCart();

  useEffect(() => {
    if (ready) clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return null;
}
