import { config } from "./config";

/**
 * Transactional email sending.
 *
 * Primary transport is the Gmail API (users/me/messages/send) authenticated
 * with a refresh token — no SDK required, just two plain HTTP calls.
 * Without credentials every message is printed to the server console
 * (console outbox) so the flow stays observable during local development.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const DEFAULT_FROM = "mark-armour <tearsmithtearsmith@gmail.com>";
/** Refresh the access token this many ms before Google says it expires. */
const TOKEN_SKEW_MS = 5 * 60 * 1000;

/** Module-scoped access token cache (survives within one server process). */
let cachedToken: { value: string; expiresAt: number } | null = null;
/** De-dupe simultaneous refreshes so a burst of sends only hits Google once. */
let refreshing: Promise<string | null> | null = null;

function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
}

/** ASCII-safe subject line (RFC 2047 headers must not carry raw UTF-8). */
function asciiSubject(subject: string): string {
  return subject.replace(/[^\x20-\x7E]/g, "-");
}

async function refreshAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    console.error("Gmail token refresh failed:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = (await res.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
  } | null;
  const value = data?.access_token;
  if (!value) return null;
  const expiresAt = Date.now() + Math.max(60, Number(data?.expires_in ?? 3600)) * 1000;
  cachedToken = { value, expiresAt };
  return value;
}

/** Cached access token — refreshed only when (nearly) expired. */
async function getAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt - TOKEN_SKEW_MS > Date.now()) {
    return cachedToken.value;
  }
  if (!refreshing) {
    refreshing = refreshAccessToken().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

function buildMime(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}): string {
  const headers = [
    `From: ${fromAddress()}`,
    `To: ${input.to}`,
    `Subject: ${asciiSubject(input.subject)}`,
    "MIME-Version: 1.0",
  ];
  // Reply-To lets contact-form replies reach the sender instead of ourselves.
  const replyTo = input.replyTo?.trim().replace(/[\r\n]/g, "");
  if (replyTo) headers.push(`Reply-To: ${replyTo}`);

  if (input.html) {
    const boundary = `ma-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    return [
      ...headers,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      input.text,
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      input.html,
      `--${boundary}--`,
      "",
    ].join("\r\n");
  }

  headers.push("Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: 8bit");
  return [...headers, "", input.text, ""].join("\r\n");
}

function consoleOutbox(input: { to: string; subject: string; text: string }): void {
  console.log(
    `\n────────────── 📧 CONSOLE OUTBOX (email transport not configured) ──────────────\n` +
      `To:      ${input.to}\nSubject: ${input.subject}\n\n${input.text}\n` +
      `──────────────────────────────────────────────────────────────\n`,
  );
}

async function gmailSend(raw: string): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;
  const res = await fetch(SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  if (res.ok) return true;
  if (res.status === 401) {
    // Token rejected — force one refresh and retry exactly once.
    cachedToken = null;
    const fresh = await refreshAccessToken();
    if (!fresh) return false;
    const retry = await fetch(SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fresh}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
    if (retry.ok) return true;
    console.error("Gmail send failed:", retry.status, await retry.text().catch(() => ""));
    return false;
  }
  console.error("Gmail send failed:", res.status, await res.text().catch(() => ""));
  return false;
}

/**
 * Send an email. Always resolves (never throws) so callers can fire-and-forget.
 *
 * - Gmail API when `GMAIL_REFRESH_TOKEN` is set → `{ mode: "gmail" }`
 * - otherwise the console outbox             → `{ mode: "console" }`
 */
export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}): Promise<{ delivered: boolean; mode: "gmail" | "console" }> {
  const to = input.to.trim().replace(/[\r\n]/g, "");
  const subject = input.subject.trim() || "(no subject)";
  if (!to) return { delivered: false, mode: "console" };

  if (!config.hasGmail) {
    consoleOutbox({ to, subject, text: input.text });
    return { delivered: true, mode: "console" };
  }

  try {
    const raw = Buffer.from(
      buildMime({ to, subject, text: input.text, html: input.html, replyTo: input.replyTo }),
    ).toString("base64url");
    const sent = await gmailSend(raw);
    if (sent) {
      console.log(`✉️  Gmail sent "${subject}" to ${to}`);
      return { delivered: true, mode: "gmail" };
    }
  } catch (err) {
    console.error("Gmail send threw:", err);
  }
  // Transport failed — fall back to the console so the message is still visible.
  consoleOutbox({ to, subject, text: input.text });
  return { delivered: true, mode: "console" };
}

/**
 * Dark MARK-ARMOUR email shell used for buttons-style emails
 * (verification, password reset, …) — matches the order confirmation look.
 */
export function brandEmail(input: {
  heading: string;
  kicker?: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
}): string {
  const cta =
    input.ctaText && input.ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px;">
           <tr>
             <td align="center" bgcolor="#f59e0b" style="border-radius:0;">
               <a href="${input.ctaUrl}"
                  style="display:inline-block;padding:13px 30px;background:#f59e0b;color:#070908;
                         font-weight:800;letter-spacing:1.5px;text-transform:uppercase;font-size:13px;
                         text-decoration:none;">
                 ${input.ctaText}
               </a>
             </td>
           </tr>
         </table>`
      : "";

  const kicker = input.kicker
    ? `<p style="color:#8a9a5e;font-size:13px;margin:0 0 20px;">${input.kicker}</p>`
    : "";

  return `
  <div style="background:#070908;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#0b0e0c;border:1px solid #1b221e;">
      <div style="background:#f59e0b;color:#070908;padding:18px 24px;font-weight:800;letter-spacing:2px;">
        MARK-ARMOUR
      </div>
      <div style="padding:24px;">
        <h1 style="color:#f59e0b;font-size:20px;margin:0 0 4px;">${input.heading}</h1>
        ${kicker}
        <div style="color:#d6d3cd;font-size:14px;line-height:1.7;">${input.bodyHtml}</div>
        ${cta}
        <p style="margin-top:22px;font-size:12px;color:#6f7d4b;line-height:1.6;">
          If the button doesn't work, copy and paste the link into your browser.
          You are receiving this because an account was created at mark-armour.
        </p>
      </div>
    </div>
  </div>`;
}
