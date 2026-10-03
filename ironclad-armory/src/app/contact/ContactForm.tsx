"use client";

import { useState } from "react";
import Link from "next/link";

const SUBJECTS = [
  "Order status or change",
  "Shipping & FFL transfer",
  "Returns & refunds",
  "Payment or receipt issue",
  "Age / ID verification",
  "Product question",
  "Custom build request",
  "Account help (sign-in, email, deletion)",
  "Partnership, press or careers",
  "Something else",
];

type Status = "idle" | "busy" | "done" | "error";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
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
        body: JSON.stringify({ name, email, subject, message, website }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not send your message — please try again.");
        setStatus("error");
        return;
      }
      setStatus("done");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setError("Network error — please try again.");
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="card p-8" role="status">
        <div className="flex h-11 w-11 items-center justify-center bg-blaze-500 font-display text-lg font-black text-onbrand">
          ✓
        </div>
        <h2 className="mt-4 font-display text-xl font-black uppercase tracking-tight text-stone-100">
          Message sent
        </h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-stone-500">
          It has landed in our inbox and you will get a reply from a human —
          usually within one business day, order issues first. A copy of what you
          sent is on its way to your email address as well.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="btn-primary"
          >
            Send another message
          </button>
          <Link href="/faq" className="btn-ghost">
            Browse the FAQ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="cf-name">
            Your name
          </label>
          <input
            id="cf-name"
            className="input"
            required
            maxLength={120}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Shooter"
          />
        </div>
        <div>
          <label className="label" htmlFor="cf-email">
            Email address
          </label>
          <input
            id="cf-email"
            type="email"
            className="input"
            required
            maxLength={254}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="cf-subject">
          What is this about?
        </label>
        <select
          id="cf-subject"
          className="input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        >
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="cf-message">
          Message
        </label>
        <textarea
          id="cf-message"
          className="input min-h-40 resize-y"
          required
          minLength={10}
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Order number (if you have one), what happened, and what you need from us."
        />
        <p className="mt-1.5 text-[11px] text-stone-600">
          Include your order number for the fastest answer — we prioritise
          verification and shipping issues.
        </p>
      </div>

      {/* honeypot — hidden from humans */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="sr-only"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
      />

      {error && status === "error" && (
        <div className="border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300" role="alert">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={status === "busy"}
          className="btn-primary disabled:opacity-60"
        >
          {status === "busy" ? "Sending…" : "Send message"}
        </button>
        <span className="text-xs text-stone-500">
          Prefer self-service?{" "}
          <Link href="/faq" className="text-blaze-500 hover:text-blaze-400">
            Check the FAQ first
          </Link>
          .
        </span>
      </div>
    </form>
  );
}
