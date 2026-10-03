"use client";

import { useState } from "react";

type Status = "idle" | "busy" | "done" | "error";

/**
 * Newsletter signup — posts to /api/contact, which emails the site owner
 * through the shared sendMail helper (no newsletter table in the DB).
 */
export default function NewsletterForm({
  id = "newsletter-email",
  className = "",
}: {
  id?: string;
  className?: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "busy") return;
    setStatus("busy");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Newsletter subscriber",
          email,
          subject: "Newsletter subscription",
          message: `Please add ${email} to the mark-armour newsletter.`,
          website: "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not subscribe — please try again.");
        setStatus("error");
        return;
      }
      setEmail("");
      setStatus("done");
    } catch {
      setError("Network error — please try again.");
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div
        className={`border border-olive-700 bg-olive-700/15 p-4 text-sm text-olive-300 ${className}`}
        role="status"
      >
        You&apos;re on the list. Watch your inbox for new drops, restocks and
        range-day deals.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={className}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={id} className="sr-only">
          Email address
        </label>
        <input
          id={id}
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input sm:flex-1"
        />
        {/* honeypot — humans never see it */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="sr-only"
          value=""
          onChange={() => undefined}
        />
        <button
          type="submit"
          disabled={status === "busy"}
          className="btn-primary shrink-0 disabled:opacity-60"
        >
          {status === "busy" ? "Joining…" : "Subscribe"}
        </button>
      </div>
      {status === "error" && error && (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
      <p className="mt-2 text-[11px] text-stone-600">
        One or two emails a month. Unsubscribe any time — no data is sold, ever.
      </p>
    </form>
  );
}
