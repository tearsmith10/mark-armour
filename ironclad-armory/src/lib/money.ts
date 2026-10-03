export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );

export const FREE_SHIPPING_THRESHOLD = 50_000; // $500
export const FLAT_SHIPPING = 1_995; // $19.95

export function shippingFor(subtotalCents: number) {
  return subtotalCents >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
}
