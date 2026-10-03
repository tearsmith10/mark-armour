import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { initDb } from "@/lib/db";
import type { WeaponRequest } from "@/lib/types";
import RequestForm from "@/components/RequestForm";

export const metadata = { title: "Custom Request" };

export default async function CustomRequestPage() {
  const user = await currentUser();

  let requests: WeaponRequest[] = [];
  if (user?.id) {
    const db = await initDb();
    const { rows } = await db.query<WeaponRequest>(
      "SELECT * FROM weapon_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
      [user.id],
    );
    requests = rows;
  }

  return (
    <div className="container-page py-12">
      <div className="mb-8 max-w-3xl">
        <h1 className="font-display text-3xl font-black uppercase tracking-tight text-stone-100">
          Custom request
        </h1>
        <p className="mt-2 leading-relaxed text-stone-500">
          Can&apos;t find the weapon you want? Describe it in your own words — the live
          picture search pulls <strong className="text-stone-300">real photographs</strong>{" "}
          from the internet (Wikimedia Commons) so you can point at exactly what you mean.
          We&apos;ll source it and follow up by email.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RequestForm signedIn={Boolean(user)} />
        </div>

        <aside className="lg:col-span-2">
          <div className="card p-6">
            <h2 className="font-display text-sm font-black uppercase tracking-widest text-stone-300">
              Your requests
            </h2>
            {!user ? (
              <div className="mt-4 text-sm text-stone-500">
                <Link href="/login?next=/custom" className="text-blaze-500 hover:text-blaze-400">
                  Sign in
                </Link>{" "}
                to submit and track custom requests.
              </div>
            ) : requests.length === 0 ? (
              <p className="mt-4 text-sm text-stone-500">
                No requests yet — describe something above and it will appear here with its
                status.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {requests.map((r) => (
                  <li key={r.id} className="border-b border-ink-700 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm leading-relaxed text-stone-300">{r.description}</p>
                      <span className="badge shrink-0 border border-olive-700 bg-olive-700/30 text-olive-300">
                        {r.status}
                      </span>
                    </div>
                    {r.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.image_url}
                        alt={r.image_title ?? "Requested weapon"}
                        className="mt-3 h-24 w-full max-w-[10rem] border border-ink-700 object-cover"
                      />
                    )}
                    <div className="mt-2 text-[11px] text-stone-600">
                      {new Date(r.created_at).toLocaleDateString("en-US", {
                        dateStyle: "medium",
                      })}
                      {r.image_title ? ` · picture: ${r.image_title}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
