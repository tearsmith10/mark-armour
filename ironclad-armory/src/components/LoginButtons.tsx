"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

type Busy = null | "google" | "yahoo" | "credentials" | "identity" | "resend";

/** Friendly copy for Auth.js error codes (`?error=` / `?code=`). */
function messageFor(error?: string | null, code?: string | null): string | null {
  if (!error) return null;
  if (code === "verify_email") {
    return "If you just signed up, verify your email first — we sent you a confirmation link.";
  }
  if (error === "Configuration") {
    return "Sign-in is temporarily unavailable. Please try again in a moment.";
  }
  if (error === "CredentialsSignin") {
    return "Email or password is incorrect. If you just signed up, verify your email first — resend the link below.";
  }
  if (error === "AccessDenied") {
    return "Access denied. If you just signed up, verify your email first.";
  }
  if (error === "OAuthAccountNotLinked") {
    return "That email is already linked to a different sign-in method.";
  }
  if (error === "OAuthSignin" || error === "OAuthCallback" || error === "OAuthCreateAccount") {
    return "The sign-in was cancelled or failed. Please try again.";
  }
  if (error === "Verification" || error === "MissingCSRF") {
    return "Your sign-in session expired. Please try again.";
  }
  if (error === "AccessDenied") return "Access denied.";
  return "Sign-in failed. Please try again.";
}

function Divider({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="h-px flex-1 bg-ink-700" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-stone-600">{text}</span>
      <span className="h-px flex-1 bg-ink-700" />
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-red-500/40 bg-red-500/10 p-3 text-sm leading-relaxed text-red-300">
      {children}
    </div>
  );
}

export default function LoginButtons({
  hasGoogle,
  hasYahoo,
  callbackUrl,
  error,
  code,
}: {
  hasGoogle: boolean;
  hasYahoo: boolean;
  callbackUrl: string;
  error?: string | null;
  code?: string | null;
}) {
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<string | null>(
    messageFor(error ?? null, code ?? null),
  );
  const [showResend, setShowResend] = useState(code === "verify_email");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [idType, setIdType] = useState<"ssn" | "national_id">("ssn");
  const [idNumber, setIdNumber] = useState("");
  const [resent, setResent] = useState(false);

  const oauth = (provider: "google" | "yahoo") => {
    setBusy(provider);
    void signIn(provider, { callbackUrl });
  };

  const withEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("credentials");
    setMessage(null);
    const res = await signIn("credentials", { email, password, callbackUrl, redirect: false });
    if (res?.error) {
      setMessage(messageFor(res.error, res.code) ?? "Sign-in failed. Please try again.");
      setShowResend(res.code === "verify_email" || res.error === "CredentialsSignin");
      setBusy(null);
      return;
    }
    window.location.href = res?.url ?? callbackUrl;
  };

  const withIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("identity");
    setMessage(null);
    const res = await signIn("identity", { fullName, idType, idNumber, callbackUrl, redirect: false });
    if (res?.error) {
      setMessage(
        "No account matches that name and document number. ID verification happens at checkout — place an order first, or sign in with email above.",
      );
      setBusy(null);
      return;
    }
    window.location.href = res?.url ?? callbackUrl;
  };

  const resend = async () => {
    if (!email.trim()) {
      setMessage("Enter your email above so we know where to send the link.");
      return;
    }
    setBusy("resend");
    try {
      await fetch("/api/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setResent(true);
      setMessage(null);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-6 space-y-5">
      <button
        type="button"
        onClick={() => oauth("google")}
        disabled={!hasGoogle || busy !== null}
        className="btn w-full border border-ink-600 bg-white text-sm font-bold normal-case tracking-normal text-zinc-800 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        Continue with Google
      </button>

      {!hasGoogle && (
        <p className="border border-ink-700 bg-ink-800 p-3 text-[11px] leading-relaxed text-stone-500">
          <strong className="text-blaze-400">Google OAuth not configured yet.</strong>{" "}
          Set <code className="text-olive-400">GOOGLE_CLIENT_ID</code> /{" "}
          <code className="text-olive-400">GOOGLE_CLIENT_SECRET</code> in{" "}
          <code className="text-olive-400">.env.local</code> (Google Cloud Console →
          Credentials → redirect URI{" "}
          <code className="text-olive-400">/api/auth/callback/google</code>) to enable
          the button above.
        </p>
      )}

      <button
        type="button"
        onClick={() => oauth("yahoo")}
        disabled={!hasYahoo || busy !== null}
        className="btn w-full border border-ink-600 bg-[#6001d2] text-sm font-bold normal-case tracking-normal text-white hover:bg-[#7201f0] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M6.68 15.13c-.44-.5-.87-.98-1.29-1.44.8-1.16 1.63-2.3 2.48-3.4.03 1.05.02 2.1.03 3.15-.41.62-.8 1.22-1.22 1.69m10.75-9.9L12.9 12.5l2.44 8.06c.47.31.95.36 1.45.09 1.05-.56 2.08-1.18 3.09-1.85.08-2.45.1-4.9-.1-7.34-.66-2.6-2.6-4.83-5.34-6.06M6.06 2.56l-3.5 2.05c1.9 1.53 3.74 3.12 5.74 4.57.03-2.2.03-4.4-.05-6.62-.71-.06-1.44-.06-2.19 0" />
        </svg>
        Continue with Yahoo
      </button>

      {!hasYahoo && (
        <p className="border border-ink-700 bg-ink-800 p-3 text-[11px] leading-relaxed text-stone-500">
          Yahoo sign-in activates once{" "}
          <code className="text-olive-400">YAHOO_CLIENT_ID</code> /{" "}
          <code className="text-olive-400">YAHOO_CLIENT_SECRET</code> are set.
        </p>
      )}

      {message && (
        <ErrorBox>
          {message}
          {showResend && (
            <button
              type="button"
              onClick={resend}
              disabled={busy !== null}
              className="mt-2 block text-left font-bold text-blaze-400 underline underline-offset-2 hover:text-blaze-300 disabled:opacity-50"
            >
              {busy === "resend"
                ? "Sending…"
                : resent
                  ? "Verification link sent — check your inbox ✓"
                  : "Resend verification link"}
            </button>
          )}
        </ErrorBox>
      )}

      <Divider text="or sign in with email" />

      <form onSubmit={withEmail} className="space-y-4">
        <div>
          <label className="label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
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
          <div className="flex items-baseline justify-between">
            <label className="label" htmlFor="login-password">
              Password
            </label>
            <a
              href="/forgot-password"
              className="text-[11px] text-olive-500 underline underline-offset-2 hover:text-olive-400"
            >
              Forgot password?
            </a>
          </div>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <button type="submit" disabled={busy !== null} className="btn-primary w-full">
          {busy === "credentials" ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <Divider text="or sign in with identity" />

      <form onSubmit={withIdentity} className="space-y-4">
        <div>
          <label className="label" htmlFor="identity-name">
            Full name
          </label>
          <input
            id="identity-name"
            type="text"
            required
            autoComplete="name"
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="As it appears on your ID"
          />
        </div>

        <div>
          <span className="label">Document type</span>
          <div className="flex gap-4">
            {(
              [
                { value: "ssn", label: "SSN" },
                { value: "national_id", label: "National ID" },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-2 border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                  idType === opt.value
                    ? "border-blaze-500 bg-blaze-500/10 text-blaze-400"
                    : "border-ink-600 text-stone-400 hover:border-olive-500"
                }`}
              >
                <input
                  type="radio"
                  name="idType"
                  value={opt.value}
                  checked={idType === opt.value}
                  onChange={() => setIdType(opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="identity-number">
            Document number
          </label>
          <input
            id="identity-number"
            type="text"
            required
            autoComplete="off"
            className="input"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            placeholder={idType === "ssn" ? "123-45-6789" : "ID number"}
          />
        </div>

        <button type="submit" disabled={busy !== null} className="btn-dark w-full">
          {busy === "identity" ? "Verifying…" : "Sign in with identity"}
        </button>
        <p className="text-[11px] leading-relaxed text-stone-600">
          Identity verification is captured at checkout — use the same name and document
          you entered there. Only a keyed hash of your number is stored.
        </p>
      </form>

      <p className="text-center text-[11px] text-stone-500">
        New here?{" "}
        <a
          href={`/signup?next=${encodeURIComponent(callbackUrl)}`}
          className="font-bold text-blaze-500 underline underline-offset-2 hover:text-blaze-400"
        >
          Create an account
        </a>
      </p>
    </div>
  );
}
