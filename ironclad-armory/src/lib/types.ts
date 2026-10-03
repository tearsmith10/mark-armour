export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  caliber: string;
  description: string;
  price_cents: number;
  stock: number;
  badge: string | null;
  sort_order: number;
  image_query: string;
  image_url: string | null;
  image_credit: string | null;
};

export type OrderStatus = "pending" | "paid" | "canceled" | "refunded";

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  price_cents: number;
  quantity: number;
};

export type Order = {
  id: string;
  user_id: string;
  email: string;
  status: OrderStatus;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  payment_provider: "stripe" | "demo";
  stripe_session_id: string | null;
  full_name: string;
  address1: string;
  address2: string | null;
  city: string;
  postal_code: string;
  country: string;
  phone: string | null;
  age_verified: boolean;
  id_type: string | null;
  id_number_masked: string | null;
  dob: string | null;
  emailed_at: string | null;
  created_at: string;
};

export const ID_TYPES = [
  { value: "passport", label: "International passport" },
  { value: "drivers_license", label: "Driver's licence" },
  { value: "badge", label: "Police / military badge number" },
  { value: "ssn", label: "Social security number (SSN)" },
  { value: "national_id", label: "National identification number (NIN/ID)" },
] as const;

export type IdType = (typeof ID_TYPES)[number]["value"];

export type WeaponRequest = {
  id: string;
  user_id: string;
  email: string;
  description: string;
  image_url: string | null;
  image_title: string | null;
  status: string;
  created_at: string;
};

export type Shipping = {
  fullName: string;
  email: string;
  address1: string;
  address2?: string;
  city: string;
  postalCode: string;
  country: string;
  phone?: string;
};
