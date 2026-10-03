"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/* eslint-disable @next/next/no-img-element */

type SearchHit = { title: string; thumb: string; page: string; credit: string };

export default function RequestForm({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [terms, setTerms] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced live picture search while the customer types their terms.
  useEffect(() => {
    const q = terms.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/image-search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(res.ok ? data.results ?? [] : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [terms]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          imageUrl: selected?.thumb ?? "",
          imageTitle: selected?.title ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not submit the request.");
        setSubmitting(false);
        return;
      }
      setDone(true);
      setSubmitting(false);
      setDescription("");
      setTerms("");
      setResults([]);
      setSelected(null);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-5 p-6">
      <div>
        <label className="label" htmlFor="wr-desc">
          Describe the weapon you want
        </label>
        <textarea
          id="wr-desc"
          className="input min-h-32 resize-y"
          required
          minLength={10}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Chambering, action, barrel length, finish, optics… e.g. “a stainless lever-action rifle in .44 Magnum with a wooden stock”"
        />
      </div>

      <div>
        <label className="label" htmlFor="wr-terms">
          Picture search terms (live internet results)
        </label>
        <input
          id="wr-terms"
          className="input"
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          placeholder="e.g. lever-action rifle"
        />
        <p className="mt-1.5 text-[11px] text-stone-600">
          Real photographs stream in as you type — click one to attach it to your request.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {searching && (
            <div className="col-span-full border border-dashed border-ink-600 p-4 text-center text-xs text-stone-500">
              Searching the internet for real pictures…
            </div>
          )}
          {!searching && terms.trim().length >= 2 && results.length === 0 && (
            <div className="col-span-full border border-dashed border-ink-600 p-4 text-center text-xs text-stone-500">
              No pictures found — try different terms.
            </div>
          )}
          {results.map((hit) => {
            const active = selected?.thumb === hit.thumb;
            return (
              <button
                key={hit.thumb}
                type="button"
                onClick={() => setSelected(active ? null : hit)}
                title={hit.title}
                className={`group relative block aspect-square overflow-hidden border transition-all ${
                  active
                    ? "border-blaze-500 ring-2 ring-blaze-500/50"
                    : "border-ink-700 hover:border-ink-600"
                }`}
              >
                <img
                  src={hit.thumb}
                  alt={hit.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {active && (
                  <span className="badge absolute left-1 top-1 bg-blaze-500 text-onbrand">
                    Attached
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {done && !error && (
        <div className="border border-olive-700 bg-olive-700/15 p-3 text-sm text-olive-300">
          Request received — see it in &quot;Your requests&quot;. We&apos;ll follow up by
          email.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={submitting || description.trim().length < 10} className="btn-primary">
          {submitting ? "Submitting…" : "Submit request"}
        </button>
        {!signedIn && (
          <span className="text-xs text-stone-500">
            Requires an account —{" "}
            <Link href="/login?next=/custom" className="text-blaze-500 hover:text-blaze-400">
              sign in first
            </Link>
            .
          </span>
        )}
      </div>
    </form>
  );
}
