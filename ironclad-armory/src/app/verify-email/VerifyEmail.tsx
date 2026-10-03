"use client";

import { useEffect, useRef, useState } from "react";

type State =
  | { kind: "checking" }
  | { kind: "verified"; email?: string }
  | { kind: "failed"; error: string };

export default function VerifyEmail({ token }: { token: string | null }) {
  const [state, setState] = useState<State>(token ? { kind: "checking" } : {
    kind: "failed",
    error: "This verification link is missing its token. Open the link from your inbox again.",
  });
  const [email, setEmail] = useState("");
  const [resent, setResent] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    // No cancellation guard: React 18 StrictMode re-runs effects in dev, and
    // the ref above already guarantees a single request per mount.
    (async () => {
      try {
        const res = await fetch("/api/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          email?: string;
          error?: string;
        };
        if (res.ok && data.ok) {
          setState({ kind: "verified", email: data.email });
        } else {
          setState({
            kind: "failed",
            error: data.error ?? "This verification link is invalid or has expired.",
          });
        }
      } catch {
        setState({ kind: "failed", error: "Network error — please try again." });
      }
    })();
  }, [token]);

  const resend = async () => {
    if (!email.trim()) return;
    try {
      await fetch("/api/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setResent(true);
    } catch {
      // Best effort.
    }
  };

  if (state.kind === "checking") {
    return (
      <div className="mt-6">
        <h1 className="font-display text-2xl font-black uppercase tracking-tight text-stone-100">
          Verifying…
        </h1>
        <p className="mt-2 text-sm text-stone-500">Confirming your email address.</p>
      </div>
    );
  }

  if (state.kind === "verified") {
    return (
      <div className="mt-6">
        <div className="mb-4 h-10 w-10 border border-olive-500/50 bg-olive-500/10 text-center font-display text-xl leading-10 text-olive-400">
          ✓
        </div>
        <h1 className="font-display text-2xl font-black uppercase tracking-tight text-stone-100">
          Email verified
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-400">
          {state.email ? (
            <>
              <span className="font-bold text-blaze-500">{state.email}</span> is
              confirmed — you can now sign in with your password.
            </>
          ) : (
            "Your address is confirmed — you can now sign in."
          )}
        </p>
        <a href="/login" className="btn-primary mt-6 w-full">
          Sign in
        </a>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h1 className="font-display text-2xl font-black uppercase tracking-tight text-stone-100">
        Verification failed
      </h1>
      <div className="mt-4 border border-red-500/40 bg-red-500/10 p-3 text-sm leading-relaxed text-red-300">
        {state.error}
      </div>

      <p className="mt-5 text-sm text-stone-500">
        Enter your email and we&apos;ll send a fresh link:
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email"
        />
        <button
          type="button"
          onClick={resend}
          disabled={!email.trim() || resent}
          className="btn-primary shrink-0 disabled:opacity-50"
        >
          {resent ? "Sent ✓" : "Resend"}
        </button>
      </div>

      <a
        href="/login"
        className="mt-6 block text-center text-[11px] text-stone-500 underline underline-offset-2 hover:text-stone-400"
      >
        Back to sign in
      </a>
    </div>
  );
}
