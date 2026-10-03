import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { setIdentity } from "@/lib/accounts";
import { config } from "@/lib/config";
import { createOrder, getOrderItems } from "@/lib/orders";
import { getProductsBySlugs } from "@/lib/products";
import { createCheckoutSession } from "@/lib/stripe";
import { validateVerification } from "@/lib/verify";
import type { Shipping } from "@/lib/types";

/**
 * Checkout endpoint — step 4 of the flow:
 * prices are ALWAYS re-read from the database on the server,
 * never trusted from the client payload.
 */
export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    return NextResponse.json({ error: "Please sign in to check out." }, { status: 401 });
  }

  let body: {
    items?: { slug?: string; qty?: number }[];
    shipping?: Partial<Shipping>;
    ageVerified?: boolean;
    verification?: { dob?: string; idType?: string; idNumber?: string };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const shipping = body.shipping ?? {};
  const required: [keyof Shipping, string][] = [
    ["fullName", "Full name"],
    ["email", "Email"],
    ["address1", "Street address"],
    ["city", "City"],
    ["postalCode", "Postal code"],
  ];
  for (const [key, label] of required) {
    if (!String(shipping[key] ?? "").trim()) {
      return NextResponse.json({ error: `${label} is required.` }, { status: 400 });
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shipping.email!)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // 18+ identity verification — authoritative check (never trust the client).
  const verification = validateVerification(body.verification ?? {});
  if (!verification.ok) {
    return NextResponse.json({ error: verification.error }, { status: 400 });
  }
  if (!body.ageVerified) {
    return NextResponse.json(
      { error: "You must confirm the 18+ declaration." },
      { status: 400 },
    );
  }

  // Persist the verified identity (HMAC hash only, never the raw number) so
  // the customer can later sign in with "identity" credentials.
  const rawIdNumber = String(body.verification?.idNumber ?? "");
  if (rawIdNumber) {
    await setIdentity(user.id, verification.idType, rawIdNumber);
  }

  const rawItems = (body.items ?? [])
    .map((i) => ({ slug: String(i.slug ?? ""), qty: Math.floor(Number(i.qty ?? 0)) }))
    .filter((i) => i.slug && i.qty > 0);
  if (rawItems.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  // Server-side price + stock validation (prices come from the DB).
  const products = await getProductsBySlugs([...new Set(rawItems.map((i) => i.slug))]);
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const quantities: Record<string, number> = {};
  for (const item of rawItems) {
    const product = bySlug.get(item.slug);
    if (!product) {
      return NextResponse.json(
        { error: `Product "${item.slug}" no longer exists.` },
        { status: 400 },
      );
    }
    if (item.qty > 10) {
      return NextResponse.json({ error: "Maximum quantity is 10 per item." }, { status: 400 });
    }
    if (product.stock < item.qty) {
      return NextResponse.json(
        { error: `Only ${product.stock} × "${product.name}" left in stock.` },
        { status: 400 },
      );
    }
    quantities[item.slug] = (quantities[item.slug] ?? 0) + item.qty;
  }

  const order = await createOrder({
    userId: user.id,
    email: shipping.email!,
    products,
    quantities,
    shipping: {
      fullName: shipping.fullName!,
      email: shipping.email!,
      address1: shipping.address1!,
      address2: shipping.address2,
      city: shipping.city!,
      postalCode: shipping.postalCode!,
      country: (shipping.country || "US").toUpperCase().slice(0, 2),
      phone: shipping.phone,
    },
    provider: config.hasStripe ? "stripe" : "demo",
    ageVerified: true,
    verification: {
      idType: verification.idType,
      idNumberMasked: verification.idNumberMasked,
      dob: verification.dob,
    },
  });

  const origin = new URL(req.url).origin;

  if (config.hasStripe) {
    const items = await getOrderItems(order.id);
    const url = await createCheckoutSession(order, items, origin);
    return NextResponse.json({ ok: true, orderId: order.id, url });
  }

  return NextResponse.json({ ok: true, orderId: order.id, url: `/checkout/pay/${order.id}` });
}

/** Order summary for the checkout page (server truth for the review panel). */
export async function GET() {
  return NextResponse.json({ provider: config.hasStripe ? "stripe" : "demo" });
}
