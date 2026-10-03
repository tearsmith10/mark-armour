import ResetPasswordForm from "./ResetPasswordForm";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md border border-ink-700 bg-ink-900 p-8 shadow-panel sm:p-10">
        <div className="font-display text-xl font-black uppercase tracking-widest text-stone-100">
          mark<span className="text-blaze-500">-armour</span>
        </div>
        <h1 className="mt-6 font-display text-2xl font-black uppercase tracking-tight text-stone-100">
          Reset password
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Choose a new password for your account.
        </p>
        <ResetPasswordForm token={token ?? null} />
        <p className="mt-6 border-t border-ink-700 pt-5 text-center text-[11px] text-stone-600">
          <a href="/login" className="underline underline-offset-2 hover:text-stone-400">
            Back to sign in
          </a>
        </p>
      </div>
    </div>
  );
}
