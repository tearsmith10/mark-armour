"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FaqSection } from "./faq-data";

type OpenState = Record<string, boolean>;

export default function FaqAccordion({ sections }: { sections: FaqSection[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<OpenState>({});
  const [expandAll, setExpandAll] = useState(false);

  const needle = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!needle) return sections;
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.q.toLowerCase().includes(needle) ||
            item.a.toLowerCase().includes(needle),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, needle]);

  const totalShown = filtered.reduce((n, s) => n + s.items.length, 0);
  const total = sections.reduce((n, s) => n + s.items.length, 0);

  // While searching or after "Expand all", answers default open — an explicit
  // per-item toggle always wins so the +/- buttons stay honest.
  const defaultOpen = needle.length > 0 || expandAll;
  const isOpen = (key: string) =>
    open[key] !== undefined ? open[key] : defaultOpen;

  const toggle = (key: string) => {
    const next = !isOpen(key);
    setOpen((prev) => ({ ...prev, [key]: next }));
  };

  const toggleExpandAll = () => {
    setOpen({});
    setExpandAll((v) => !v);
  };

  // A new search resets per-item overrides so freshly-matched answers are open.
  const updateQuery = (value: string) => {
    setOpen({});
    setQuery(value);
  };

  return (
    <div>
      {/* Search */}
      <div className="card sticky top-24 z-10 p-4">
        <label htmlFor="faq-search" className="label">
          Search the FAQ
        </label>
        <div className="relative">
          <input
            id="faq-search"
            type="search"
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            placeholder="e.g. FFL, refund, passport, password…"
            autoComplete="off"
            className="input pr-10"
          />
          {query && (
            <button
              type="button"
              onClick={() => updateQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center text-stone-500 transition-colors hover:text-blaze-400"
            >
              ✕
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-widest text-stone-600" role="status">
            Showing {totalShown} of {total} questions
          </p>
          {!needle && (
            <button
              type="button"
              onClick={toggleExpandAll}
              className="text-[11px] font-bold uppercase tracking-widest text-blaze-500 hover:text-blaze-400"
            >
              {expandAll ? "Collapse all" : "Expand all"}
            </button>
          )}
        </div>
      </div>

      {/* Sections */}
      {filtered.length === 0 ? (
        <div className="card mt-6 p-10 text-center">
          <p className="font-display text-lg font-bold text-stone-300">
            No answers match “{query}”.
          </p>
          <p className="mt-2 text-sm text-stone-500">
            Try a single word — “shipping”, “refund”, “passport” — or ask us
            directly and we’ll answer by email.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => updateQuery("")} className="btn-ghost">
              Clear search
            </button>
            <Link href="/contact" className="btn-primary">
              Ask a question
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-10">
          {filtered.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-32">
              <h2 className="font-display text-xl font-black uppercase tracking-tight text-stone-100">
                {section.title}
              </h2>
              <div className="mt-4 divide-y divide-ink-700 border-y border-ink-700">
                {section.items.map((item) => {
                  const key = `${section.id}/${item.q}`;
                  const expanded = isOpen(key);
                  const panelId = `faq-panel-${key.replace(/[^a-z0-9]+/gi, "-")}`;
                  const buttonId = `faq-question-${key.replace(/[^a-z0-9]+/gi, "-")}`;
                  return (
                    <div key={key}>
                      <h3>
                        <button
                          type="button"
                          id={buttonId}
                          aria-expanded={expanded}
                          aria-controls={panelId}
                          onClick={() => toggle(key)}
                          className="flex w-full items-start justify-between gap-6 py-4 text-left transition-colors hover:text-blaze-400"
                        >
                          <span className="text-sm font-bold text-stone-200 sm:text-base">
                            {item.q}
                          </span>
                          <span
                            aria-hidden="true"
                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-ink-600 text-sm leading-none text-blaze-500 transition-transform duration-200 ${
                              expanded ? "rotate-45 border-blaze-500" : ""
                            }`}
                          >
                            +
                          </span>
                        </button>
                      </h3>
                      <div
                        id={panelId}
                        role="region"
                        aria-labelledby={buttonId}
                        className={`faq-panel ${expanded ? "is-open" : ""}`}
                      >
                        <div className="faq-panel-inner">
                          <p className="max-w-3xl pb-5 pr-8 text-sm leading-relaxed text-stone-500">
                            {item.a}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="card mt-12 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="font-display text-lg font-black uppercase tracking-tight text-stone-100">
            Still have questions?
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Our team answers within one business day — order issues first, always.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/contact" className="btn-primary">
            Contact support
          </Link>
          <Link href="/shipping" className="btn-ghost">
            Shipping & returns
          </Link>
        </div>
      </div>
    </div>
  );
}
