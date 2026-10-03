export type FaqItem = { q: string; a: string };

export type FaqSection = {
  id: string;
  title: string;
  items: FaqItem[];
};

export const FAQ_SECTIONS: FaqSection[] = [
  {
    id: "ordering",
    title: "Ordering & stock",
    items: [
      {
        q: "How do I place an order?",
        a: "Add items to your cart, open the cart and continue to checkout. Sign in with Google, Yahoo or an email account, confirm your shipping/FFL details, complete the 18+ ID verification step and pay through Stripe Checkout. You will get an itemised confirmation by email within seconds of a successful payment.",
      },
      {
        q: "Is everything on the site actually in stock?",
        a: "Stock counts on every product card are live and come straight from our inventory database. If a counter says 7, we have 7 on the shelf and reserved stock is removed the moment an order is paid — you are never sold an item we cannot ship.",
      },
      {
        q: "An item I want is out of stock — what can I do?",
        a: "Out-of-stock items show an “Out of stock” badge on the card. Sign in and we will email you the moment it is restocked, or submit a custom request describing what you want and our armourers will source an equivalent. Popular calibers typically return within 7–14 days.",
      },
      {
        q: "Can I change or cancel an order after placing it?",
        a: "Yes, as long as the order has not been handed to the carrier. Contact us immediately with your order number — we can edit the shipping address, swap an item or cancel and refund in full. Once a parcel is scanned by the carrier it must go through the normal return process.",
      },
    ],
  },
  {
    id: "pricing",
    title: "Pricing & promotions",
    items: [
      {
        q: "Are your prices fixed? Do you price-match?",
        a: "Listed prices are what you pay — no hidden dealer markup at the register. We run periodic price-match requests case by case on identical, in-stock, manufacturer-warranty items; send us a link to the competing listing and we will tell you honestly whether we can match it.",
      },
      {
        q: "Do you offer discounts, bundles or a loyalty program?",
        a: "Newsletter subscribers get first notice of restock pricing, range-day bundle deals and seasonal promotions — that is what the mailing list is for. Buying for a club or range? Contact us about volume pricing on ammunition and optics.",
      },
      {
        q: "Why is my checkout total different from the listed price?",
        a: "Your subtotal is the sum of item prices. Shipping is a flat $19.95 and is free when your subtotal reaches $500 or more. Sales tax (where applicable) and any FFL transfer fee charged by your receiving dealer are shown before you pay — the transfer fee is collected by the dealer, never by us.",
      },
    ],
  },
  {
    id: "shipping",
    title: "Shipping & delivery",
    items: [
      {
        q: "How much does shipping cost?",
        a: "Flat $19.95 anywhere in the continental US, and free on orders of $500 or more. Expedited options are shown at checkout. Every parcel is insured for its full value and requires a signature on delivery.",
      },
      {
        q: "How long will my order take to arrive?",
        a: "In-stock orders paid before 2pm local time dispatch the same business day; everything else within 24 hours. Typical transit is 1–3 business days for the east/central US and 2–5 for the west coast. Serialized items add the FFL transfer step at your dealer, usually 1–3 days after arrival plus any state-mandated waiting period.",
      },
      {
        q: "What is an FFL transfer and why must firearms ship there?",
        a: "Federal law requires that firearms sold across state lines (and most interstate sales generally) transfer through a licensed Federal Firearms License holder. At checkout you choose the dealer who should receive your order; we ship insured to that dealer, they log the firearm into their bound book and complete the background check and transfer to you in person.",
      },
      {
        q: "Is my shipment insured and can I track it?",
        a: "Yes to both. Every order ships with full-value insurance and a tracking number that is emailed to you the moment the label is created, and it appears in My Orders. You can watch it move from our bench to your dealer on the carrier’s site.",
      },
      {
        q: "Which items ship directly to me?",
        a: "Optics, ammunition (where lawful), blades, gear, clothing and accessories ship to your door. Anything serialized — rifles, pistols, shotguns, receivers — must go to an FFL. Ammunition cannot ship to states or carriers that restrict caliber or capacity; checkout blocks those combinations automatically.",
      },
    ],
  },
  {
    id: "exceptions",
    title: "Delivery exceptions",
    items: [
      {
        q: "My tracking hasn’t updated in 3 days — should I worry?",
        a: "Carriers occasionally skip scans, especially over weekends and through remote hubs. Give it 48 hours past the last scan. If it is still frozen, contact us with your order number and we will open a trace with the carrier and, if the parcel is truly lost, reship or refund you at your choice.",
      },
      {
        q: "The package shows delivered but I don’t have it.",
        a: "Check with neighbours, your building desk and your dealer (for FFL shipments) first — carriers sometimes scan early. If it is not located within 24 hours, tell us immediately. Because every parcel is insured, we file the claim and either replace the item or refund you in full.",
      },
      {
        q: "Can you ship to a PO box or my home address?",
        a: "Ammunition, optics and gear can go to a PO box where the carrier allows it. Firearms and anything else serialized must ship to a physical FFL address — we cannot deliver them to a PO box or a private residence, and carriers will refuse the label.",
      },
    ],
  },
  {
    id: "returns",
    title: "Returns & refunds",
    items: [
      {
        q: "What is your return policy?",
        a: "Unopened, unused items in original packaging can be returned within 30 days of delivery for a full refund of the item price. Start the request through our contact form with your order number and we will send a prepaid return label and instructions.",
      },
      {
        q: "Can I return a firearm or other serialized item?",
        a: "Serialized items can only be returned if they arrive damaged, defective or are not the item you ordered — and they must go back through an FFL to an FFL. Contact us first; we arrange the dealer-to-dealer transfer and cover the shipping. Change-of-mind returns on firearms are handled case by case because of the transfer cost.",
      },
      {
        q: "How long do refunds take?",
        a: "Once we receive and inspect the return (usually 1–2 business days after delivery), refunds are issued to the original payment method immediately. Your bank or card issuer then posts it in 3–10 business days. You get an email the moment the refund is issued.",
      },
      {
        q: "My item arrived damaged — what now?",
        a: "Photograph the packaging and the damage and contact us within 48 hours. We will ship a replacement the same day and file the carrier claim ourselves, so you are never left chasing an insurer.",
      },
      {
        q: "Do I pay return shipping?",
        a: "Not if the fault is ours — damaged, defective or incorrectly shipped items always get a prepaid label. For change-of-mind returns on non-serialized items, a flat $9.95 is deducted from the refund unless the item was misrepresented on its product page.",
      },
    ],
  },
  {
    id: "payment",
    title: "Payment",
    items: [
      {
        q: "What payment methods do you accept?",
        a: "All major cards (Visa, Mastercard, American Express, Discover), Apple Pay and Google Pay — all processed by Stripe Checkout. We never see or store your card number; Stripe handles the capture and passes us a payment confirmation only.",
      },
      {
        q: "Is checkout secure?",
        a: "Checkout runs entirely on Stripe’s PCI-DSS Level 1 certified infrastructure over TLS. Card details are tokenised before they reach us, so no card data is ever written to our database or logs. The site is served over HTTPS end to end.",
      },
      {
        q: "When am I actually charged?",
        a: "At the moment Stripe confirms payment for the order — not when you add items to the cart. If an order cannot be fulfilled (for example, an ID verification failure), you are refunded in full immediately and never charged twice for a resubmission.",
      },
      {
        q: "My payment failed or I was charged but got no confirmation email — what do I do?",
        a: "Failed payments are almost always a bank fraud hold or an address/AVS mismatch; try another card or contact your issuer. If money left your account but no order email arrived, check My Orders first (the order may exist even if the email bounced), then contact us with the time and amount — we will reconcile it against Stripe within one business day.",
      },
      {
        q: "Do you keep my card details on file?",
        a: "No. We store a Stripe customer/payment reference so receipts and refunds map correctly, but the card itself lives only in Stripe’s vault. You can delete the reference from your account at any time.",
      },
    ],
  },
  {
    id: "verification",
    title: "Age & ID verification",
    items: [
      {
        q: "Why do I have to verify my age and identity?",
        a: "You must be 18 or older to buy from mark-armour, and federal and state law requires us to confirm who is buying firearms, ammunition and certain gear. Verification happens once per account before dispatch — it keeps us compliant and keeps your orders moving without repeated checks.",
      },
      {
        q: "Which documents do you accept?",
        a: "Any one of: a passport, a driver’s licence, a military or law-enforcement badge, a Social Security number (SSN) with your full legal name, or a national ID card (including NIN for Nigerian customers). The document must be unexpired, match the name on your account, and be legible in the photo you upload.",
      },
      {
        q: "How is my ID evidence stored — is it safe?",
        a: "Uploads are encrypted at rest, access-restricted to the verification team, and masked: only the last few characters of the identifier and a hashed fingerprint are retained in the database. The raw image is reviewed and then deleted on a short retention schedule. We never sell or share verification data with third parties for marketing.",
      },
      {
        q: "What happens if my verification fails?",
        a: "You get an email explaining which check failed (blurry photo, expired document, name mismatch) and you can resubmit — most failures are fixed by retaking the photo in better light. Your order is held, not cancelled: nothing ships and nothing is lost while you retry. If it still cannot be verified, the order is voided and refunded in full.",
      },
      {
        q: "Do I have to verify every single order?",
        a: "No — verification is stored against your account. Once approved you can reorder without re-uploading. We will only ask again if your account details change (new shipping state, new name) or if a regulator requires a periodic re-check.",
      },
    ],
  },
  {
    id: "account",
    title: "Account & sign-in",
    items: [
      {
        q: "How do I sign in with Google?",
        a: "On the sign-in page choose “Continue with Google”, pick your account and approve the prompt. We receive only your name, email and profile picture — no Google password is ever shared with us. First-time Google sign-ins create your mark-armour account automatically.",
      },
      {
        q: "Can I sign in with Yahoo?",
        a: "Yes. Choose the Yahoo option on the sign-in page and complete the same OAuth consent flow. Your Yahoo address becomes your account email, and you can add a password later if you want a second way in.",
      },
      {
        q: "How do I create an account with email and password?",
        a: "Pick “Create account” on the sign-in page, enter your name, email and a strong password, and confirm the verification link we email you. Until you click that link, order history still works but checkout will ask you to confirm before dispatch.",
      },
      {
        q: "I forgot my password — how do I reset it?",
        a: "Click “Forgot password?” on the sign-in page and enter your account email. The reset link is valid for 60 minutes and can be used once. If the email doesn’t arrive, check spam and then contact us — we can trigger a fresh link manually.",
      },
      {
        q: "Can I sign in with my SSN or NIN instead of a password?",
        a: "Yes — on the sign-in page choose “Verify with SSN / NIN”, enter your full legal name exactly as it appears on your document plus your SSN (US) or NIN (Nigeria), and we match it against your stored verification record. Only a masked hash of the number is stored; nobody at mark-armour can read your full number back.",
      },
      {
        q: "How do I change my email address or delete my account?",
        a: "Account settings (or the link in any order email) lets you change your email after confirming the new address. To delete your account, send a request from that address via our contact form with the subject “Account deletion” — we remove your profile, cart and verification evidence within 30 days, keeping only the minimal order records tax law requires.",
      },
    ],
  },
  {
    id: "custom",
    title: "Custom requests",
    items: [
      {
        q: "How does a custom weapon request work?",
        a: "Describe exactly what you want on the custom request page — chambering, action, barrel length, finish, furniture, optics — and attach a photo from the live picture search so there is no ambiguity. Our armourers source it from distributor stock or a builder, then send you a quote and lead time by email. Nothing is charged until you approve the quote.",
      },
      {
        q: "How long does a custom build take?",
        a: "Sourced-but-in-catalog items usually resolve within 1–2 business days and ship like a normal order. True one-off builds typically run 4–10 weeks depending on parts availability, and we send progress updates at each milestone. If a timeline will slip, you hear it from us before you have to ask.",
      },
    ],
  },
  {
    id: "international",
    title: "International orders",
    items: [
      {
        q: "Do you ship outside the United States?",
        a: "We currently ship only to US addresses, and serialized items only to licensed US FFL dealers. International visitors can browse, create an account and submit custom requests — we will quote a specialist export route where the destination country’s law allows it.",
      },
      {
        q: "I’m in Canada, the UK or Australia — can I order?",
        a: "Not through standard checkout. Those markets have their own import and licensing rules, so drop us a line through the contact form with your province/state and what you are after: where legal we arrange dealer-to-dealer export with the correct paperwork, and where it is not we will tell you straight away rather than take your money.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy & data security",
    items: [
      {
        q: "What data do you actually keep about me?",
        a: "Your account (name, email, hashed password or OAuth id), shipping/FFL addresses, order history, masked ID-verification evidence, and standard analytics such as your theme preference stored in localStorage under mark-armour-theme. Card data never touches us — see our privacy policy for the full breakdown.",
      },
      {
        q: "Do you sell or share my data?",
        a: "Never. We do not sell personal data, we do not rent email lists, and the only third parties that receive anything are the ones required to run the store: Stripe for payments, our mail provider for transactional email, and the carrier for delivery. Verification documents are never shared with any of them.",
      },
    ],
  },
  {
    id: "app",
    title: "Mobile app",
    items: [
      {
        q: "How do I install the mark-armour app?",
        a: "Open the store on your phone and visit /app — the install guide covers iOS (Safari → Add to Home Screen) and Android (Chrome → Install app). Installation takes under a minute and no app-store account is required.",
      },
      {
        q: "Does the app use the same cart and account as the website?",
        a: "Yes. The app is the same store, so your cart, saved items, orders and verification status are shared instantly in both places. Add a scope on your laptop, check out from the couch on your phone — it is one account.",
      },
      {
        q: "Does the app work offline?",
        a: "The shell, previously viewed products and your cart are cached so you can browse and draft a cart with no signal. Checkout, price checks and order placement need a connection, and your cart syncs the moment you are back online.",
      },
    ],
  },
  {
    id: "contact",
    title: "Contact & escalation",
    items: [
      {
        q: "How do I get in touch — and how fast do you reply?",
        a: "Use the contact form (response target: one business day, usually much sooner) or email us directly. Order and verification issues are prioritised ahead of general questions. If something has gone wrong and the first reply does not fix it, reply to that email with the word “escalate” — it goes straight to the duty manager.",
      },
      {
        q: "Where are you based?",
        a: "Our armoury and dispatch bench are in Boise, Idaho, staffed Monday to Friday 9am–6pm MT (order cut-off 2pm MT). The online store, however, never closes — orders placed at midnight are picked the next morning.",
      },
    ],
  },
];

export const FAQ_TOTAL = FAQ_SECTIONS.reduce(
  (n, section) => n + section.items.length,
  0,
);
