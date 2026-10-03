import VerifyEmail from "./VerifyEmail";

export const metadata = { title: "Verify email" };

export default async function VerifyEmailPage({
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
        <VerifyEmail token={token ?? null} />
      </div>
    </div>
  );
}
