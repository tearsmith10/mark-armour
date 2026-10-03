import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { config } from "./config";
import { initDb, newId } from "./db";
import { brandEmail, sendMail } from "./email";

/**
 * Email + password accounts (scrypt hashing, no extra dependencies),
 * e-mail verification and password-reset flows, and the HMAC identity
 * fingerprint used by the "sign in with identity" credentials provider.
 */

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem?: number },
) => Promise<Buffer>;

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const KEY_LEN = 64;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SignUpResult =
  | { ok: true }
  | { ok: false; error: string; code: "exists" | "invalid" };

/** `scrypt$<saltB64>$<hashB64>` */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LEN, SCRYPT);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  try {
    const salt = Buffer.from(parts[1], "base64");
    const expected = Buffer.from(parts[2], "base64");
    if (expected.length !== KEY_LEN) return false;
    const actual = await scrypt(password, salt, expected.length, SCRYPT);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function passwordError(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return "Password must contain both letters and numbers.";
  }
  return null;
}

function verifyUrl(token: string) {
  return `${config.siteUrl}/verify-email?token=${encodeURIComponent(token)}`;
}

function resetUrl(token: string) {
  return `${config.siteUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

/** Fire-and-forget wrapper — never breaks the caller's flow. */
function queueMail(input: { to: string; subject: string; text: string; html?: string }) {
  sendMail(input).catch((err) => console.error("email send failed:", err));
}

async function sendVerification(email: string, name: string | null, token: string) {
  const url = verifyUrl(token);
  queueMail({
    to: email,
    subject: "Verify your email — MARK-ARMOUR",
    text: [
      "MARK-ARMOUR — verify your email",
      "",
      `Hi ${name ?? "there"},`,
      "Confirm this address to activate password sign-in:",
      url,
      "",
      "This link expires in 24 hours. If you didn't create an account, ignore this email.",
    ].join("\n"),
    html: brandEmail({
      heading: "Verify your email",
      kicker: "One quick step to activate your account",
      bodyHtml: `<p>Hi ${name ?? "there"},</p>
        <p>Confirm this address to activate password sign-in for your MARK-ARMOUR account.</p>
        <p style="font-size:12px;color:#6f7d4b;word-break:break-all;">${url}</p>`,
      ctaText: "Verify email",
      ctaUrl: url,
    }),
  });
}

async function sendPasswordReset(email: string, name: string | null, token: string) {
  const url = resetUrl(token);
  queueMail({
    to: email,
    subject: "Reset your password — MARK-ARMOUR",
    text: [
      "MARK-ARMOUR — password reset",
      "",
      `Hi ${name ?? "there"},`,
      "Choose a new password using this link:",
      url,
      "",
      "This link expires in 1 hour. If you didn't request this, ignore this email.",
    ].join("\n"),
    html: brandEmail({
      heading: "Reset your password",
      kicker: "Requested for your MARK-ARMOUR account",
      bodyHtml: `<p>Hi ${name ?? "there"},</p>
        <p>Use the link below to choose a new password. It expires in 1 hour.</p>
        <p style="font-size:12px;color:#6f7d4b;word-break:break-all;">${url}</p>`,
      ctaText: "Reset password",
      ctaUrl: url,
    }),
  });
}

/**
 * Create an account (or attach a password to an existing OAuth-only one)
 * and send the verification e-mail. The e-mail is queued fire-and-forget.
 */
export async function signUp(input: {
  email: string;
  fullName: string;
  password: string;
}): Promise<SignUpResult> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const password = input.password;

  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address.", code: "invalid" };
  }
  if (fullName.length < 3) {
    return { ok: false, error: "Enter your full name (at least 3 characters).", code: "invalid" };
  }
  const pwError = passwordError(password);
  if (pwError) return { ok: false, error: pwError, code: "invalid" };

  const db = await initDb();
  type Row = {
    id: string;
    name: string | null;
    password_hash: string | null;
    email_verified_at: string | null;
  };
  const { rows } = await db.query<Row>(
    "SELECT id, name, password_hash, email_verified_at FROM users WHERE LOWER(email) = $1",
    [email],
  );
  const existing = rows[0];
  const passwordHash = await hashPassword(password);
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  if (existing) {
    if (existing.password_hash) {
      return {
        ok: false,
        error: "An account with that email already exists.",
        code: "exists",
      };
    }
    // OAuth-only account (Google/Yahoo) — let the owner set a password too.
    await db.query(
      "UPDATE users SET password_hash = $1, name = COALESCE(NULLIF($2, ''), name) WHERE id = $3",
      [passwordHash, fullName, existing.id],
    );
    if (!existing.email_verified_at) {
      await db.query(
        "UPDATE users SET verify_token = $1, verify_expires = $2 WHERE id = $3",
        [token, expires, existing.id],
      );
      await sendVerification(email, fullName || existing.name, token);
    }
    return { ok: true };
  }

  const id = newId();
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO users (id, email, name, password_hash, verify_token, verify_expires)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [id, email, fullName, passwordHash, token, expires],
  );
  if (!inserted.rows[0]) {
    // Lost a race with a concurrent signup for the same address.
    return {
      ok: false,
      error: "An account with that email already exists.",
      code: "exists",
    };
  }
  await sendVerification(email, fullName, token);
  return { ok: true };
}

/** Consume a verification token (24h expiry) and mark the address verified. */
export async function verifyEmail(
  token: string,
): Promise<{ ok: boolean; email?: string; error?: string }> {
  const t = token.trim();
  if (!t) return { ok: false, error: "Missing verification token." };

  const db = await initDb();
  const { rows } = await db.query<{ id: string; email: string }>(
    "SELECT id, email FROM users WHERE verify_token = $1 AND verify_expires > NOW()",
    [t],
  );
  const user = rows[0];
  if (!user) return { ok: false, error: "This verification link is invalid or has expired." };

  await db.query(
    "UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()), verify_token = NULL, verify_expires = NULL WHERE id = $1",
    [user.id],
  );
  return { ok: true, email: user.email };
}

/**
 * Re-send the verification e-mail. Always reports success so attackers
 * can't probe which addresses are registered.
 */
export async function resendVerification(email: string): Promise<{ ok: true }> {
  const addr = email.trim().toLowerCase();
  if (EMAIL_RE.test(addr)) {
    const db = await initDb();
    const { rows } = await db.query<{
      id: string;
      email: string;
      name: string | null;
      email_verified_at: string | null;
    }>(
      "SELECT id, email, name, email_verified_at FROM users WHERE LOWER(email) = $1",
      [addr],
    );
    const user = rows[0];
    if (user && !user.email_verified_at) {
      const token = randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db.query("UPDATE users SET verify_token = $1, verify_expires = $2 WHERE id = $3", [
        token,
        expires,
        user.id,
      ]);
      await sendVerification(user.email, user.name, token);
    }
  }
  return { ok: true };
}

/**
 * Start a password reset. Only accounts that actually have a password are
 * touched; the response is always generic (no account enumeration).
 */
export async function requestPasswordReset(email: string): Promise<{ ok: true }> {
  const addr = email.trim().toLowerCase();
  if (EMAIL_RE.test(addr)) {
    const db = await initDb();
    const { rows } = await db.query<{
      id: string;
      email: string;
      name: string | null;
      password_hash: string | null;
    }>(
      "SELECT id, email, name, password_hash FROM users WHERE LOWER(email) = $1",
      [addr],
    );
    const user = rows[0];
    if (user?.password_hash) {
      const token = randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await db.query("UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3", [
        token,
        expires,
        user.id,
      ]);
      await sendPasswordReset(user.email, user.name, token);
    }
  }
  return { ok: true };
}

/** Consume a reset token (1h expiry) and store the new password hash. */
export async function resetPassword(input: {
  token: string;
  password: string;
}): Promise<{ ok: boolean; error?: string }> {
  const t = input.token.trim();
  if (!t) return { ok: false, error: "Missing reset token." };
  const pwError = passwordError(input.password);
  if (pwError) return { ok: false, error: pwError };

  const db = await initDb();
  const { rows } = await db.query<{ id: string; email: string }>(
    "SELECT id, email FROM users WHERE reset_token = $1 AND reset_expires > NOW()",
    [t],
  );
  const user = rows[0];
  if (!user) return { ok: false, error: "This reset link is invalid or has expired." };

  const passwordHash = await hashPassword(input.password);
  await db.query(
    `UPDATE users
        SET password_hash = $1,
            reset_token = NULL,
            reset_expires = NULL,
            email_verified_at = COALESCE(email_verified_at, NOW()),
            verify_token = NULL,
            verify_expires = NULL
      WHERE id = $2`,
    [passwordHash, user.id],
  );
  return { ok: true };
}

/** Normalize an ID number for fingerprinting: uppercase, A-Z0-9 only. */
function normalizeId(idNumber: string): string {
  return idNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * HMAC-SHA256 fingerprint of an ID number — the raw number is NEVER stored,
 * only this keyed hash (so the identity sign-in provider can match on it).
 */
export function hashIdNumber(idNumber: string): string {
  const secret = process.env.AUTH_SECRET || "ironclad-armory-dev-secret-change-me";
  return createHmac("sha256", secret).update(normalizeId(idNumber)).digest("hex");
}

/** Persist the checkout-verified identity on the user (hash only). */
export async function setIdentity(
  userId: string,
  idType: string,
  idNumber: string,
): Promise<void> {
  const normalized = normalizeId(idNumber);
  if (!normalized) return;
  const db = await initDb();
  await db.query("UPDATE users SET id_type = $1, id_hash = $2 WHERE id = $3", [
    idType,
    hashIdNumber(idNumber),
    userId,
  ]);
}

/** OAuth sign-ins are provider-verified — mark the address confirmed. */
export async function markEmailVerified(userId: string): Promise<void> {
  const db = await initDb();
  await db.query(
    "UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1",
    [userId],
  );
}
