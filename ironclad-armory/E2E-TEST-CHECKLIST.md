# mark-armour — Post-Deploy E2E Test Results (2026-10-02)

Production: https://mark-armour.vercel.app — deployments dpl_C24txKbMBxZKLZdZFGZB8mYKELf8, dpl_G6ZqJbJsGofrRDLdyx4LA17hrrEn

## 1. Auth (credentials) — PASS
- [x] POST /api/signup (email + fullName + password) → 200; row in Postgres with scrypt hash, verify_token, verify_expires
- [x] Weak/missing fields rejected (400 + message)
- [x] POST /api/verify-email → 200, email_verified_at set; token reuse → 400
- [x] Sign-in blocked until verified (VerifyEmailSignin, ?error=CredentialsSignin&code=verify_email)
- [x] Forgot password → 200 (same shape for unknown emails = enumeration-safe)
- [x] Reset password → 200; reuse → 410; short password → 400
- [x] Real browser sign-in with NEW password → session cookie issued, /api/auth/session returns user
- [x] Demo/instant account gone (no demo wording/providers)

## 2. Alternate sign-in — PASS
- [x] Google button present (OAuth env configured)
- [x] Yahoo button present, disabled with setup note until YAHOO_CLIENT_ID/SECRET added
- [x] SSN + full name identity sign-in → session established
- [x] Wrong SSN (999-99-9999) → rejected, stays signed out
- [x] NIN option present in document type select

## 3. Header / footer / FAQ / hero — PASS
- [x] /faq 200 with 47 questions (133KB), first question rendered
- [x] /about /contact /shipping /privacy /terms all 200
- [x] Hero: real AKM photo /header.jpg (image/jpeg, 200), visible credit caption
- [x] Footer links render on all pages (FAQ, shipping, contact, orders, app, legal)

## 4. Catalog images — PASS (prior audit: 17/17 distinct Wikimedia photos)

## 5. PWA — PASS (static)
- [x] /manifest.json 200 application/json (standalone, icons, shortcuts)
- [x] /sw.js 200 application/javascript; /offline.html 200; icons + favicon 200
- [x] /app install page 200 with install instructions
- [ ] On-device install (needs real phone — see instructions below)

## 6. Cart sync — PASS (after fix)
- [x] Signed-in PUT /api/cart → independent GET returns hydrated line
- [x] Cart badge + page reflect server cart
- [x] BUG FOUND & FIXED: background tab hydration pushed debounced `PUT []`,
      wiping items added by another device. Fix: hydration only pushes when
      merged state differs from server snapshot (CartProvider.tsx).
- [x] Re-deployed (dpl_G6ZqJbJsGofrRDLdyx4LA17hrrEn); stable across 6+ polls

## 7. Payment — PASS (full production E2E)
- [x] Cart $2,598.00 → Stripe hosted checkout with correct line item/qty
- [x] Test card 4242…4242 → session complete / payment_status paid / pi_3UM9CgBuzasCwAeK1rn4RcTe
- [x] Redirect to /orders → "✅ Payment confirmed", order #51DA94C2 PAID
- [x] Postgres order: status=paid, total_cents=259800, 1 line item
- [x] Webhook evt_1UM9ChBuzasCwAeKuGVuVPmS → 200 (STRIPE_WEBHOOK_SECRET live)
- [x] Confirmation email sent via Gmail: "Order confirmed — #51DA94C2 · $2,598.00"

## 8. Age gate / ID verification — PASS
- [x] Checkout requires DOB + document type + number + 18+ checkbox
- [x] users.id_type='ssn' captured; id_hash = 64-hex SHA-256 (no raw digits leak)

## 9. Theme — PASS
- [x] Toggle writes mark-armour-theme ("light") and applies to <html>

## Known follow-ups
- Yahoo sign-in activates when YAHOO_CLIENT_ID/SECRET env is added (needs a real
  phone number to create the Yahoo developer app — currently not available).
- Real-money Stripe requires identity/bank verification in Stripe dashboard.
- Contact form has honeypot but no rate limiting (add later if abused).

## Mobile test instructions (give to user)
1. Open https://mark-armour.vercel.app on the phone
2. Android Chrome: ⋮ → "Add to Home screen" → Install
3. iOS Safari: Share → "Add to Home Screen"
4. Launch from the icon — full app, same account & cart as desktop
5. Add an item on desktop → watch it appear in the phone cart within ~4s
