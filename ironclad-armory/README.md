# mark-armour

A full-stack weaponry shop: Google sign-in, database-backed cart & checkout,
server-side price validation, Stripe payments, and Mailgun order confirmations —
built with **Next.js 15 (App Router) + React 19 + TypeScript + Tailwind**.

**It runs with zero configuration.** Every integration is optional at runtime —
missing credentials fall back to a built-in demo mode, so you can test the entire
purchase flow today and flip each service on by filling `.env.local`.

---

## The order flow

| # | Step | Where it happens |
|---|------|------------------|
| 1 | Customer signs in with **Google** (Google Cloud Console OAuth) | `/login` → Auth.js v5 → `/api/auth/callback/google` |
| 2 | Google returns the user to the app; a `users` row is upserted | `src/lib/auth.ts` → `users` table |
| 3 | Customer builds a cart (localStorage + DB-synced when signed in) | `CartProvider` → `cart_items` table |
| 4 | Checkout endpoint **re-reads prices from the database** (never trusts the client), validates stock, shipping and the 21+ confirmation | `POST /api/checkout` |
| 5 | Payment confirmed — **Stripe Checkout + webhook**, or the built-in demo gateway when no key is present | `/api/webhooks/stripe` or `/api/checkout/[id]/pay` |
| 6 | Order + line items are persisted (`orders`, `order_items`), stock decremented — exactly once, guarded by status transition | `src/lib/orders.ts` |
| 7 | Confirmation email sent through **Mailgun's REST API** (HTML + text) | `src/lib/mailgun.ts` |
| 8 | Customer sees the order on the authenticated **My Orders** page | `/orders` |

---

## Quick start (demo mode — works immediately)

```bash
npm install
npm run dev
```

Open http://localhost:3000 → **Sign in instantly** (any email) → add products →
checkout → demo payment → order lands in Postgres-style tables and the confirmation
email prints to the server console (**📧 DEMO OUTBOX**).

Without `DATABASE_URL` the app uses an **embedded local Postgres** (PGlite) persisted
in `./.data/` — same SQL that runs on Supabase/Neon, so nothing changes when you
upgrade to a cloud database.

---

## Going live — configure each service

Copy the template, then fill in what you have (any subset works):

```bash
cp .env.example .env.local
```

The footer (dev mode only) shows which services are active:
`db · auth · pay · mail`.

### 1. Database — Supabase **or** Neon (both are plain Postgres)

**Supabase** ([supabase.com](https://supabase.com) → new project → *Connect → Engine: Postgres*):

```env
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0.<region>.pooler.supabase.com:6543/postgres?sslmode=require
```

**Neon** ([neon.com](https://neon.tech) → project → *Connection Details*):

```env
DATABASE_URL=postgres://<user>@<endpoint>.neon.tech/<db>?sslmode=require
```

Tables (`users`, `products`, `orders`, `order_items`, `cart_items`) and the product
catalog create themselves automatically on first run. The same schema ships with a
handy SQL dump in [`schema.sql`](./schema.sql) if you prefer to apply it manually
(Supabase → SQL Editor / Neon → SQL Editor).

### 2. Google authentication — Google Cloud Console

1. [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → OAuth consent screen** (External, add your email).
2. **Credentials → Create Credentials → OAuth client ID → Web application**.
3. Authorized redirect URI:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
   (add `https://your-domain/api/auth/callback/google` for production)
4. Paste into `.env.local`:

```env
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
```

The **Continue with Google** button enables automatically; the demo sign-in stays
available alongside it. Also set a real session secret:

```env
AUTH_SECRET=openssl rand -base64 32
```

### 3. Payments — Stripe

1. [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) → copy the **secret key**:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

2. Point the webhook at your app:
   - Local: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
   - Production: Dashboard → **Developers → Webhooks → Add endpoint**
     `https://your-domain/api/webhooks/stripe` (event: `checkout.session.completed`), then copy the signing secret.

With a key present, checkout redirects to **Stripe's hosted page**; the webhook
marks the order paid, decrements stock and sends the email. Without a key, the
built-in demo payment page does the same three things.

### 4. Email — Mailgun

1. [Mailgun](https://app.mailgun.com) → **Sending → API Keys** (and a verified domain):

```env
MAILGUN_API_KEY=key-xxxx
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_FROM="mark-armour <orders@mg.yourdomain.com>"
# EU region: https://api.eu.mailgun.net/v3
MAILGUN_API_BASE=https://api.mailgun.net/v3
```

Without keys, confirmations render to the server console instead (**demo outbox**),
including the full HTML/text body.

---

## Deploying to Vercel

```bash
npm i -g vercel
vercel            # detect framework (Next.js), then:
vercel env add DATABASE_URL
vercel env add AUTH_SECRET
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_WEBHOOK_SECRET
vercel env add MAILGUN_API_KEY
vercel env add MAILGUN_DOMAIN
vercel env add MAILGUN_FROM
vercel env add NEXT_PUBLIC_SITE_URL   # https://your-domain
vercel --prod
```

> ⚠️ Production **requires a cloud database** (`DATABASE_URL`) — the embedded
> fallback is for local development only (serverless filesystems are read-only).
> Add your production callback URI to Google: `https://your-domain/api/auth/callback/google`.

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                  # Home — hero, categories, featured
│   ├── products/                 # Catalog + product detail
│   ├── cart/                     # Cart (client, DB-synced)
│   ├── checkout/                 # Shipping + review → POST /api/checkout
│   │   └── pay/[id]/             # Demo gateway (no Stripe key)
│   ├── orders/                   # Authenticated order history
│   ├── login/                    # Google + instant demo sign-in
│   └── api/
│       ├── auth/[...nextauth]/   # Auth.js (Google OAuth)
│       ├── cart/                 # GET/PUT persisted cart
│       ├── checkout/             # Server-side price validation + order create
│       │   └── [id]/pay/         # Demo payment confirmation
│       └── webhooks/stripe/      # Stripe → paid → email
├── components/                   # Navbar, cart provider, product art, forms
└── lib/
    ├── auth.ts                   # Auth.js config (Google + demo)
    ├── db.ts                     # Postgres (DATABASE_URL) or embedded PGlite
    ├── orders.ts                 # Order creation, paid transition, stock, email
    ├── mailgun.ts                # Mailgun REST + HTML template
    ├── stripe.ts                 # Checkout Sessions, webhook verification
    ├── products.ts / catalog.ts  # Queries + seed catalogue
    └── config.ts                 # Which services are active
```

## Scripts

```bash
npm run dev      # development (http://localhost:3000)
npm run build    # production build
npm run start    # serve the production build
```

## Compliance notes

Demo storefront only — no real firearms are sold. It models US retail rules:
purchasers must be **21+**, serialized items ship to an **FFL dealer** for a NICS
background check, and the checkout requires an explicit age/eligibility confirmation.
