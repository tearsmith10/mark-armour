"use client";

import { useState } from "react";

type State =
  | { kind: "form" }
  | { kind: "sent"; email: string };

export default function SignupForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, setState] = useState<State>({ kind: "form" });
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not create the account. Try again.");
        return;
      }
      setState({ kind: "sent", email: email.trim() });
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setResent(false);
    try {
      await fetch("/api/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: state.kind === "sent" ? state.email : email }),
      });
      setResent(true);
    } catch {
      // Best effort — the endpoint answers generically anyway.
    }
  };

  if (state.kind === "sent") {
    return (
      <div className="mt-6 space-y-5">
        <div className="border border-olive-500/40 bg-olive-500/10 p-5">
          <h2 className="font-display text-lg font-black uppercase tracking-tight text-stone-100">
            Check your inbox
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-400">
            We sent a verification link to{" "}
            <span className="font-bold text-blaze-500">{state.email}</span>. Click it
            to activate your account — the link is valid for 24 hours.
          </p>
          <p className="mt-3 text-[11px] leading-relaxed text-stone-500">
            Nothing yet? Check spam, or resend below.
          </p>
          <button
            type="button"
            onClick={resend}
            className="btn-ghost mt-4 w-full text-xs"
          >
            {resent ? "Link sent again ✓" : "Resend verification email"}
          </button>
        </div>

        <a href={`/login?next=${encodeURIComponent(callbackUrl)}`} className="btn-primary w-full">
          Back to sign in
        </a>
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
        <label className="label" htmlFor="signup-email">
          Email
        </label>
        <input
          id="signup-email"
          type="email"
          required
          autoComplete="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="label" htmlFor="signup-name">
          Full name
        </label>
        <input
          id="signup-name"
          type="text"
          required
          minLength={3}
          autoComplete="name"
          className="input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jane Shooter"
        />
      </div>

      <div>
        <label className="label" htmlFor="signup-password">
          Password
        </label>
        <input
          id="signup-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        <p className="mt-1.5 text-[11px] text-stone-500">
          At least 8 characters with letters and numbers.
        </p>
      </div>

      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "Creating…" : "Create account"}
      </button>

      <p className="text-center text-[11px] text-stone-500">
        Already have an account?{" "}
        <a
          href={`/login?next=${encodeURIComponent(callbackUrl)}`}
          className="font-bold text-blaze-500 underline underline-offset-2 hover:text-blaze-400"
        >
          Sign in
        </a>
      </p>
    </form>
  );
}
