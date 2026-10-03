import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import CheckoutForm from "@/components/CheckoutForm";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await currentUser();
  const { next } = await searchParams;
  if (!user) {
    const target = encodeURIComponent(`/checkout${next ? `?next=${next}` : ""}`);
    redirect(`/login?next=${target}`);
  }

  return (
    <div className="container-page py-12">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-black uppercase tracking-tight text-stone-100">
          Checkout
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Signed in as <span className="text-olive-400">{user.email}</span> · all prices
          confirmed against the database before payment.
        </p>
      </div>

      <CheckoutForm
        defaultEmail={user.email ?? ""}
        defaultName={user.name ?? ""}
        provider={config.hasStripe ? "stripe" : "demo"}
      />
    </div>
  );
}
