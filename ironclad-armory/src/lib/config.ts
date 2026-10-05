/**
 * Service detection — every integration is optional at runtime.
 * Missing credentials fall back to local stand-ins so the store
 * always works locally, and goes fully live once .env.local is filled.
 */
export const config = {
  get databaseUrl() {
    return process.env.DATABASE_URL?.trim() || "";
  },
  get hasDatabase() {
    return !!this.databaseUrl;
  },
  get hasGoogle() {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  },
  get hasStripe() {
    return !!process.env.STRIPE_SECRET_KEY;
  },
  get hasStripeWebhook() {
    return !!process.env.STRIPE_WEBHOOK_SECRET;
  },
  get hasMailgun() {
    return !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
  },
  /** Gmail API sending is available (refresh token present). */
  get hasGmail() {
    return !!process.env.GMAIL_REFRESH_TOKEN;
  },
  get hasYahoo() {
    return !!(process.env.YAHOO_CLIENT_ID && process.env.YAHOO_CLIENT_SECRET);
  },
  get siteUrl() {
    const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    if (explicit) return explicit;
    // On Vercel, never fall back to localhost: verification/reset links must
    // point at the real deployment even if NEXT_PUBLIC_SITE_URL was not set.
    // VERCEL_PROJECT_PRODUCTION_URL is the stable *.vercel.app host; VERCEL_URL
    // is the per-deployment host (previews).
    const vercelHost =
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      (process.env.VERCEL ? process.env.VERCEL_URL : "");
    if (vercelHost) return `https://${vercelHost}`;
    return "http://localhost:3000";
  },
  /** Everything needed for a fully live store is present. */
  get isLive() {
    return (
      this.hasDatabase &&
      this.hasGoogle &&
      this.hasStripe &&
      (this.hasMailgun || this.hasGmail)
    );
  },
};

export function serviceSummary() {
  const email = config.hasGmail
    ? "Gmail API"
    : config.hasMailgun
      ? `Mailgun (${process.env.MAILGUN_DOMAIN})`
      : "console outbox";
  return {
    database: config.hasDatabase
      ? `Postgres (${new URL(config.databaseUrl).host})`
      : "embedded local Postgres",
    google: config.hasGoogle ? "Google sign-in enabled" : "email + identity sign-in",
    stripe: config.hasStripe ? "Stripe Checkout" : "test checkout",
    email,
    mailgun: email,
    live: config.isLive,
  };
}
