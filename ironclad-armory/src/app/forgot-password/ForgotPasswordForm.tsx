"use client";

import { useState } from "react";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setError("Something went wrong — please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="mt-6 border border-olive-500/40 bg-olive-500/10 p-5">
        <h2 className="font-display text-lg font-black uppercase tracking-tight text-stone-100">
          Check your inbox
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-400">
          If an account exists for{" "}
          <span className="font-bold text-blaze-500">{email.trim()}</span>, we sent a
          link to reset the password. The link is valid for 1 hour.
        </p>
        <p className="mt-3 text-[11px] leading-relaxed text-stone-500">
          Nothing arrived? Check spam, or try again in a few minutes.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setEmail("");
          }}
          className="btn-ghost mt-4 w-full text-xs"
        >
          Use a different address
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      {error && (
        <div className="border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      <div>
        <label className="label" htmlFor="forgot-email">
          Email
        </label>
        <input
          id="forgot-email"
          type="email"
          required
          autoComplete="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
