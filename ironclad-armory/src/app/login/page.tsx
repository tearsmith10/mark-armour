import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { config } from "@/lib/config";
import LoginButtons from "@/components/LoginButtons";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; code?: string }>;
}) {
  const user = await currentUser();
  const { next, error, code } = await searchParams;
  if (user) redirect(next || "/");

  const callbackUrl = next || "/";

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-12">
      <div className="grid w-full max-w-5xl gap-0 overflow-hidden border border-ink-700 bg-ink-900 shadow-panel md:grid-cols-2">
        {/* Branding side */}
        <div className="relative hidden flex-col justify-between bg-ink-800 p-10 md:flex">
          <div>
            <div className="font-display text-xl font-black uppercase tracking-widest text-stone-100">
              mark<span className="text-blaze-500">-armour</span>
            </div>
            <h2 className="mt-10 font-display text-3xl font-black uppercase leading-tight text-stone-100">
              Your locker,
              <span className="block text-blaze-500">everywhere.</span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-stone-500">
              Sign in once and your cart, orders and receipts follow you — stored
              securely in our Postgres database.
            </p>
          </div>
          <ul className="space-y-3 text-sm text-stone-500">
            {[
              "Google, Yahoo or email sign-in",
              "Identity sign-in from your verified ID",
              "Server-side price validation",
              "Full order history in your account",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 bg-blaze-500" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Form side */}
        <div className="p-8 sm:p-10">
          <h1 className="font-display text-2xl font-black uppercase tracking-tight text-stone-100">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Use Google, Yahoo, your email and password, or your verified ID.
          </p>

          <LoginButtons
            hasGoogle={config.hasGoogle}
            hasYahoo={config.hasYahoo}
            callbackUrl={callbackUrl}
            error={error ?? null}
            code={code ?? null}
          />

          <p className="mt-8 border-t border-ink-700 pt-5 text-[11px] leading-relaxed text-stone-600">
            By signing in you confirm you are 18 or older and legally eligible to
            purchase firearms in your jurisdiction. Photo ID is verified at checkout.
          </p>
        </div>
      </div>
    </div>
  );
}
