export type SeedProduct = {
  slug: string;
  name: string;
  category: string;
  caliber: string;
  description: string;
  price_cents: number;
  stock: number;
  badge?: string;
  sort_order: number;
};

export const CATEGORIES = [
  "Rifles",
  "Pistols",
  "Shotguns",
  "Optics",
  "Ammunition",
  "Blades",
  "Gear",
] as const;

/**
 * Real-world reference term per product used to fetch genuine photography
 * from Wikimedia Commons (the fictional catalog names match real platforms).
 */
export const PRODUCT_IMAGE_QUERIES: Record<string, string> = {
  "sentinel-mk15-carbine": "M4 carbine rifle",
  "vanguard-308-battle-rifle": "AR-10 rifle",
  "longranger-precision-bolt": "precision bolt-action rifle scope",
  "ironclad-m1911a1-45": "M1911 pistol",
  "st9-compact-9mm": "Glock 19 pistol",
  "warden-revolver-357": ".357 Magnum revolver",
  "breacher-12ga-semi": "tactical semi-automatic shotgun",
  "fowlmaster-over-under-20ga": "over-under shotgun",
  "specter-1-6x-lpvo": "telescopic sight",
  "nightfall-ir-red-dot": "red dot reflex sight",
  "556-fmj-range-pack": "5.56 ammunition",
  "45-acp-training-box": "45 ACP ammunition",
  "shadowline-fixed-blade": "combat knife",
  "marksman-folding-knife": "folding pocket knife",
  "operator-plate-carrier": "plate carrier",
  "field-trauma-kit-ifak": "first aid kit",
  "ballistic-helmet-mips": "ballistic helmet",
};

export const PRODUCT_SEED: SeedProduct[] = [
  {
    slug: "sentinel-mk15-carbine",
    name: "Sentinel MK-15 Carbine",
    category: "Rifles",
    caliber: "5.56×45mm NATO",
    description:
      "Our flagship direct-impingement carbine. Cold-hammer-forged 16″ barrel, free-float M-LOK handguard and a two-stage match trigger out of the box. Built for duty, tuned for the range.",
    price_cents: 129_900,
    stock: 14,
    badge: "Best Seller",
    sort_order: 10,
  },
  {
    slug: "vanguard-308-battle-rifle",
    name: "Vanguard .308 Battle Rifle",
    category: "Rifles",
    caliber: ".308 Winchester",
    description:
      "A modern semi-auto battle rifle with an adjustable gas system and monolithic upper. Recoil is soft, the action is smooth, and it eats steel-case ammo without complaint.",
    price_cents: 164_900,
    stock: 8,
    sort_order: 20,
  },
  {
    slug: "longranger-precision-bolt",
    name: "Longranger Precision Bolt .308",
    category: "Rifles",
    caliber: ".308 Winchester",
    description:
      "Sub-MOA factory guarantee with a 24″ heavy barrel, adjustable chassis and a 60° bolt throw. The rifle you reach for when the target is past 800 metres.",
    price_cents: 219_900,
    stock: 5,
    badge: "New",
    sort_order: 30,
  },
  {
    slug: "ironclad-m1911a1-45",
    name: "Mark M1911-A1 .45",
    category: "Pistols",
    caliber: ".45 ACP",
    description:
      "A hand-fitted 1911 with a match barrel, recessed slide and G10 grips. Half-cock safety, beavertail grip safety and a crisp 3.5 lb trigger break.",
    price_cents: 89_900,
    stock: 11,
    sort_order: 40,
  },
  {
    slug: "st9-compact-9mm",
    name: "ST9 Compact 9mm",
    category: "Pistols",
    caliber: "9×19mm Parabellum",
    description:
      "Striker-fired, optics-ready compact with a 15+1 capacity and interchangeable backstraps. The everyday-carry workhorse of the mark-armour lineup.",
    price_cents: 54_900,
    stock: 22,
    badge: "Best Seller",
    sort_order: 50,
  },
  {
    slug: "warden-revolver-357",
    name: "Warden Revolver .357",
    category: "Pistols",
    caliber: ".357 Magnum",
    description:
      "Six rounds of stainless-steel certainty. Double-action pull is smooth end-to-end and the hammer-mounted sight tracks fast in low light.",
    price_cents: 77_900,
    stock: 7,
    sort_order: 60,
  },
  {
    slug: "breacher-12ga-semi",
    name: "Breacher 12-Gauge Semi-Auto",
    category: "Shotguns",
    caliber: "12 Gauge · 3″ chamber",
    description:
      "Gas-operated tactical semi-auto with an 18.5″ cylinder-bore barrel, Picatinny top rail and a six-position stock. Accepts standard tubes and chokes.",
    price_cents: 104_900,
    stock: 9,
    sort_order: 70,
  },
  {
    slug: "fowlmaster-over-under-20ga",
    name: "Fowlmaster Over/Under 20ga",
    category: "Shotguns",
    caliber: "20 Gauge · 3″ chamber",
    description:
      "A light, lively upland gun with a walnut stock, selectable chokes and a crisp single-selective trigger. Handles like a grown-up's game gun should.",
    price_cents: 149_900,
    stock: 4,
    sort_order: 80,
  },
  {
    slug: "specter-1-6x-lpvo",
    name: "Specter 1-6× LPVO",
    category: "Optics",
    caliber: "30mm tube · first focal plane",
    description:
      "True 1× on the low end, a Christmas-tree BDC on the high end, and a daylight-visible illuminated centre dot. Nitrogen-purged and IPX7 waterproof.",
    price_cents: 64_900,
    stock: 16,
    badge: "New",
    sort_order: 90,
  },
  {
    slug: "nightfall-ir-red-dot",
    name: "Nightfall IR Red-Dot",
    category: "Optics",
    caliber: "20mm · Picatinny mount included",
    description:
      "Ultra-low-profile reflex sight with a 2 MOA dot, motion-activated wake and a 50,000-hour battery life. Night-vision compatible down to NVG 1 settings.",
    price_cents: 27_900,
    stock: 31,
    sort_order: 100,
  },
  {
    slug: "556-fmj-range-pack",
    name: "5.56 FMJ Range Pack — 200 rds",
    category: "Ammunition",
    caliber: "5.56×45mm · 55gr FMJ",
    description:
      "Brass-case, non-corrosive range ammunition in a sealed 200-round range pack. Consistent velocity and clean-feeding reliability for high-volume drills.",
    price_cents: 18_900,
    stock: 48,
    sort_order: 110,
  },
  {
    slug: "45-acp-training-box",
    name: ".45 ACP Training Box — 100 rds",
    category: "Ammunition",
    caliber: ".45 ACP · 230gr FMJ",
    description:
      "Full-metal-jacket ball ammunition sized for 1911 feed ramps. Packed 100 to a box with a load-data card for reloaders.",
    price_cents: 7_900,
    stock: 60,
    sort_order: 120,
  },
  {
    slug: "shadowline-fixed-blade",
    name: "Shadowline Fixed Blade",
    category: "Blades",
    caliber: "4.7″ drop-point · 1095 steel",
    description:
      "Full-tang 1095 carbon steel with a cerakote finish, micarta scales and a moulded Kydex sheath. Field-serviceable and sharpens on a river stone.",
    price_cents: 18_900,
    stock: 25,
    sort_order: 130,
  },
  {
    slug: "marksman-folding-knife",
    name: "Marksman Folding Knife",
    category: "Blades",
    caliber: "3.4″ blade · frame lock",
    description:
      "Ball-bearing deployment, a titanium frame lock and a deep-carry pocket clip. Slim enough for a shirt pocket, tough enough for packing crates.",
    price_cents: 12_900,
    stock: 37,
    badge: "Best Seller",
    sort_order: 140,
  },
  {
    slug: "operator-plate-carrier",
    name: "Operator Plate Carrier — Level IV",
    category: "Gear",
    caliber: "Fits SAPI M/L · 10 lb set",
    description:
      "Laser-cut M-LOK carrier with quick-release buckles, padded shoulders and a cummerbund that takes soft panels. Ships with a Level IV ceramic plate set.",
    price_cents: 42_900,
    stock: 12,
    sort_order: 150,
  },
  {
    slug: "field-trauma-kit-ifak",
    name: "Field Trauma Kit (IFAK)",
    category: "Gear",
    caliber: "Tourniquet · chest seal · gauze",
    description:
      "CoTCCC-recommended tourniquet, hyphen chest seals, compressed gauze, shears and a marker in a tear-away pouch. Vacuum-sealed and dated.",
    price_cents: 14_900,
    stock: 30,
    sort_order: 160,
  },
  {
    slug: "ballistic-helmet-mips",
    name: "Ballistic Helmet — High Cut",
    category: "Gear",
    caliber: "NIJ IIIA · Size L",
    description:
      "Aramid high-cut shell with an ARC rail shroud, dial-fit suspension and gel ear-cup pads. Weighs in at 1.4 kg fully kitted.",
    price_cents: 54_900,
    stock: 6,
    sort_order: 170,
  },
];
