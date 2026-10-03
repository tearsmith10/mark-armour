import { NextResponse } from "next/server";
import { sendMail } from "@/lib/email";

/**
 * Contact / newsletter inbox — everything customers send through the contact
 * form or the footer newsletter lands in the site owner's mailbox via the
 * shared sendMail helper (src/lib/email.ts).
 */

const OWNER_EMAIL = "tearsmithtearsmith@gmail.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Flatten header-unsafe characters (CRLF injection guard). */
function safeLine(value: string, max: number): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function POST(req: Request) {
  let body: {
    name?: unknown;
    email?: unknown;
    subject?: unknown;
    message?: unknown;
    website?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Honeypot: real users never fill this invisible field.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const name = safeLine(String(body.name ?? ""), 120);
  const email = safeLine(String(body.email ?? ""), 254).toLowerCase();
  const subject = safeLine(String(body.subject ?? ""), 120);
  const message = String(body.message ?? "").trim().slice(0, 5000);

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address so we can reply." },
      { status: 400 },
    );
  }
  if (!subject) {
    return NextResponse.json(
      { error: "Choose a subject for your message." },
      { status: 400 },
    );
  }
  if (message.length < 10) {
    return NextResponse.json(
      { error: "Tell us a little more — 10 characters minimum." },
      { status: 400 },
    );
  }

  const fromName = name || "mark-armour website visitor";
  const lines = [
    `Subject: ${subject}`,
    `From: ${fromName} <${email}>`,
    `Received: ${new Date().toISOString()}`,
    "",
    message,
    "",
    "—",
    "Sent from the mark-armour contact form. Reply directly to answer the customer.",
  ];
  const text = lines.join("\n");

  const html = `
<div style="font-family:Inter,Arial,sans-serif;font-size:14px;color:#1c1917;line-height:1.6">
  <p style="margin:0 0 16px"><strong>${escapeHtml(subject)}</strong></p>
  <p style="margin:0 0 4px"><strong>From:</strong> ${escapeHtml(fromName)} &lt;${escapeHtml(email)}&gt;</p>
  <p style="margin:0 0 16px"><strong>Received:</strong> ${new Date().toUTCString()}</p>
  <div style="border-left:3px solid #f59e0b;padding:8px 14px;background:#f7f4ee;white-space:pre-wrap">${escapeHtml(message)}</div>
  <p style="margin:16px 0 0;color:#78716c;font-size:12px">
    Sent from the mark-armour contact form. Reply directly to answer the customer.
  </p>
</div>`;

  try {
    const result = await sendMail({
      to: OWNER_EMAIL,
      subject: `[mark-armour] ${subject}`,
      text,
      html,
      replyTo: `${fromName} <${email}>`,
    });

    return NextResponse.json({
      ok: true,
      delivered: result.delivered,
      mode: result.mode,
    });
  } catch (err) {
    console.error("[contact] sendMail failed:", err);
    return NextResponse.json(
      { error: "We could not send your message — please try again." },
      { status: 502 },
    );
  }
}
