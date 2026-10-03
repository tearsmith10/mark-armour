"use client";

import { useState } from "react";

export default function ResetPasswordForm({ token }: { token: string | null }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(
    token ? null : "This reset link is missing its token. Request a new one below.",
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not reset the password. Request a new link.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mt-6 space-y-5">
        <div className="border border-olive-500/40 bg-olive-500/10 p-5">
          <h2 className="font-display text-lg font-black uppercase tracking-tight text-stone-100">
            Password updated
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-400">
            Your password has been changed. Sign in with the new one.
          </p>
        </div>
        <a href="/login" className="btn-primary w-full">
          Sign in
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      {error && (
        <div className="border border-red-500/40 bg-red-500/10 p-3 text-sm leading-relaxed text-red-300">
          {error}{" "}
          {/token|expired|invalid/i.test(error) && (
            <a
              href="/forgot-password"
              className="font-bold text-blaze-400 underline underline-offset-2"
            >
              Request a new link
            </a>
          )}
        </div>
      )}

      <div>
        <label className="label" htmlFor="reset-password">
          New password
        </label>
        <input
          id="reset-password"
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

      <div>
        <label className="label" htmlFor="reset-confirm">
          Confirm new password
        </label>
        <input
          id="reset-confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      <button type="submit" disabled={busy || !token} className="btn-primary w-full">
        {busy ? "Updating…" : "Reset password"}
      </button>
    </form>
  );
}
