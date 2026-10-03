import { config } from "./config";
import { sendMail } from "./email";
import { money } from "./money";
import type { Order, OrderItem } from "./types";

function renderEmail(order: Order, items: OrderItem[]) {
  const rows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #1b221e;color:#d6d3cd;">
          ${i.name} <span style="color:#8a9a5e;">× ${i.quantity}</span>
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #1b221e;text-align:right;color:#d6d3cd;">
          ${money(i.price_cents * i.quantity)}
        </td>
      </tr>`,
    )
    .join("");

  const text = [
    `MARK-ARMOUR — Order confirmation`,
    ``,
    `Order #: ${order.id}`,
    `Status: PAID`,
    order.id_type
      ? `Age/ID verified: ${order.id_type} ending ${order.id_number_masked?.replace(/[^\dA-Za-z]/g, "").slice(-4) ?? "••••"} (18+)`
      : `Age confirmed: 18+`,
    ``,
    ...items.map((i) => `  ${i.name} × ${i.quantity} — ${money(i.price_cents * i.quantity)}`),
    ``,
    `Subtotal: ${money(order.subtotal_cents)}`,
    `Shipping: ${order.shipping_cents === 0 ? "FREE" : money(order.shipping_cents)}`,
    `Total:    ${money(order.total_cents)}`,
    ``,
    `Ship to:`,
    `${order.full_name}`,
    `${order.address1}${order.address2 ? ", " + order.address2 : ""}`,
    `${order.city}, ${order.postal_code}, ${order.country}`,
    ``,
    `Thank you for your purchase. All firearms ship to licensed FFL dealers only.`,
    `A member of our team will contact you to arrange the transfer.`,
  ].join("\n");

  const html = `
  <div style="background:#070908;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#0b0e0c;border:1px solid #1b221e;">
      <div style="background:#f59e0b;color:#070908;padding:18px 24px;font-weight:800;letter-spacing:2px;">
        MARK-ARMOUR
      </div>
      <div style="padding:24px;">
        <h1 style="color:#f59e0b;font-size:20px;margin:0 0 4px;">Order confirmed</h1>
        <p style="color:#8a9a5e;font-size:13px;margin:0 0 20px;">
          Order #${order.id.slice(0, 8).toUpperCase()} · ${new Date(order.created_at).toUTCString()}
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${rows}
          <tr>
            <td style="padding:10px 16px;color:#8a9a5e;">Subtotal</td>
            <td style="padding:10px 16px;text-align:right;color:#d6d3cd;">${money(order.subtotal_cents)}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;color:#8a9a5e;">Shipping</td>
            <td style="padding:10px 16px;text-align:right;color:#d6d3cd;">${
              order.shipping_cents === 0 ? "FREE" : money(order.shipping_cents)
            }</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;color:#f59e0b;font-weight:700;">TOTAL PAID</td>
            <td style="padding:12px 16px;text-align:right;color:#f59e0b;font-weight:700;font-size:16px;">
              ${money(order.total_cents)}
            </td>
          </tr>
        </table>
        <div style="margin-top:20px;padding:16px;background:#131815;border:1px solid #1b221e;font-size:13px;color:#a8b0aa;line-height:1.6;">
          <strong style="color:#d6d3cd;">Shipping to</strong><br/>
          ${order.full_name}<br/>
          ${order.address1}${order.address2 ? `, ${order.address2}` : ""}<br/>
          ${order.city}, ${order.postal_code}, ${order.country}
          ${
            order.id_type
              ? `<br/><br/><strong style="color:#d6d3cd;">Age/ID verified</strong><br/>${order.id_type} ${order.id_number_masked ?? ""} · 18+`
              : ""
          }
        </div>
        <p style="margin-top:20px;font-size:12px;color:#6f7d4b;line-height:1.6;">
          Firearms ship to licensed FFL dealers only — we will contact you to arrange
          the transfer. You must be 18+ to purchase. Keep this email for your records.
        </p>
      </div>
    </div>
  </div>`;

  return { text, html };
}

/**
 * Sends the order confirmation through the first available transport:
 * Gmail API → Mailgun → console outbox.
 * Without credentials it renders to the server console instead, so the
 * whole flow is still observable during local development.
 */
export async function sendOrderConfirmation(
  order: Order,
  items: OrderItem[],
): Promise<{ delivered: boolean; mode: "gmail" | "mailgun" | "console" }> {
  const { text, html } = renderEmail(order, items);
  const subject = `Order confirmed — #${order.id.slice(0, 8).toUpperCase()} · ${money(order.total_cents)}`;

  // 1) Gmail API (refresh-token flow) when configured.
  if (config.hasGmail) {
    const res = await sendMail({ to: order.email, subject, text, html });
    if (res.mode === "gmail") return { delivered: true, mode: "gmail" };
    // Gmail failed — sendMail already rendered the console fallback; only
    // worth trying Mailgun if it is actually configured.
    if (!config.hasMailgun) return { delivered: true, mode: "console" };
  }

  // 2) Mailgun REST API when configured.
  if (!config.hasMailgun) {
    if (!config.hasGmail) consoleOutbox(order.email, subject, text);
    return { delivered: true, mode: "console" };
  }

  const base = (process.env.MAILGUN_API_BASE || "https://api.mailgun.net/v3").replace(/\/$/, "");
  const domain = process.env.MAILGUN_DOMAIN!;
  const from = process.env.MAILGUN_FROM || `mark-armour <orders@${domain}>`;
  const auth = Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString("base64");

  const body = new URLSearchParams({
    from,
    to: `${order.full_name} <${order.email}>`,
    subject,
    text,
    html,
  });

  const res = await fetch(`${base}/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Mailgun send failed:", res.status, detail);
    consoleOutbox(order.email, subject, text);
    return { delivered: true, mode: "console" };
  }
  const out = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  console.log(`✉️  Mailgun confirmation sent (${out.id ?? "ok"}) to ${order.email}`);
  return { delivered: true, mode: "mailgun" };
}

/** 3) Last resort — render the message to the server console. */
function consoleOutbox(to: string, subject: string, text: string) {
  console.log(
    `\n────────────── 📧 CONSOLE OUTBOX (no email transport configured) ──────────────\n` +
      `To:      ${to}\nSubject: ${subject}\n\n${text}\n` +
      `──────────────────────────────────────────────────────────────\n`,
  );
}
