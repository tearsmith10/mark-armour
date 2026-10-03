/**
 * Real product photography via the Wikimedia Commons API (no key required).
 * Used for (1) real photos of firearms/ammunition on catalog pages and
 * (2) live internet picture search on the custom-request page.
 */

export type WikiImage = {
  title: string;
  /** 1000px-wide thumbnail, hotlinkable from upload.wikimedia.org */
  thumb: string;
  /** Direct file page for attribution */
  page: string;
  /** e.g. "Jane Doe · CC BY-SA 4.0" */
  credit: string;
};

const API = "https://commons.wikimedia.org/w/api.php";
const UA = "mark-armour-store/1.0 (demo storefront; educational project)";
const TTL_MS = 6 * 60 * 60 * 1000;

const cache = new Map<string, { value: WikiImage[]; at: number }>();

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

type CommonsPage = {
  title: string;
  imageinfo?: {
    thumburl?: string;
    descriptionurl?: string;
    mime?: string;
    extmetadata?: {
      Artist?: { value?: string };
      LicenseShortName?: { value?: string };
    };
  }[];
};

/** Search Commons for bitmap images matching `query`. */
export async function searchCommons(query: string, limit = 8): Promise<WikiImage[]> {
  const q = query.trim();
  if (!q) return [];

  const key = `${q.toLowerCase()}|${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: `filetype:bitmap ${q}`,
    gsrnamespace: "6",
    gsrlimit: String(Math.min(limit * 2, 20)),
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: "1000",
  });

  // Up to 3 attempts with backoff — Commons throttles bursts (429/empty).
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API}?${params}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Commons ${res.status}`);
      const data = (await res.json()) as { query?: { pages?: CommonsPage[] } };

      const images: WikiImage[] = [];
      for (const p of data.query?.pages ?? []) {
        const info = p.imageinfo?.[0];
        if (!info?.thumburl || !info.mime) continue;
        if (!/^image\/(jpeg|png|webp)$/.test(info.mime)) continue;
        const artist = info.extmetadata?.Artist?.value
          ? stripHtml(info.extmetadata.Artist.value)
          : "";
        const license = info.extmetadata?.LicenseShortName?.value
          ? stripHtml(info.extmetadata.LicenseShortName.value)
          : "";
        const credit = [artist, license].filter(Boolean).join(" · ") || "Wikimedia Commons";
        images.push({
          title: p.title.replace(/^File:/, ""),
          thumb: info.thumburl,
          page: info.descriptionurl ?? "https://commons.wikimedia.org/",
          credit,
        });
        if (images.length >= limit) break;
      }

      // An empty page list is usually a throttle hiccup — retry before giving up.
      if (images.length === 0 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }

      if (cache.size > 300) cache.clear();
      cache.set(key, { value: images, at: Date.now() });
      return images;
    } catch (err) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      console.warn("Commons search failed:", query, err);
      return [];
    }
  }
  return [];
}

// Ranking hints so catalog cards get clean product-style photographs
// instead of wartime/news imagery.
const GOOD_WORDS =
  /(rifle|carbine|pistol|shotgun|revolver|knife|blade|scope|sight|optic|cartridge|ammunition|ammo|magazine|helmet|vest|carrier|plate|first aid|display|collection|variant|model)/i;
const BAD_SEVERE =
  /(captured|executed|protest|funeral|riot|dead body|killing|suicide|victim)/i;
const BAD_LIGHT = /(war|soldier|troops?|combat|afghanistan|iraq|taliban|insurgent|battle|museum|memorial|monument|diagram|chart|logo|seal\b|flag)/i;

const rankCache = new Map<string, { value: WikiImage | null; at: number }>();

/** Best photo for a product — ranked, not just "first hit". */
export async function bestCommonsImage(query: string): Promise<WikiImage | null> {
  const key = query.toLowerCase().trim();
  const hit = rankCache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const results = await searchCommons(`${query}`, 12);
  let best: WikiImage | null = null;
  let bestScore = -Infinity;
  for (const img of results) {
    let score = 0;
    const t = img.title;
    if (GOOD_WORDS.test(t)) score += 2;
    if (BAD_SEVERE.test(t)) score -= 6;
    else if (BAD_LIGHT.test(t)) score -= 3;
    if (/\.(jpe?g)$/i.test(t)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = img;
    }
  }
  if (rankCache.size > 300) rankCache.clear();
  rankCache.set(key, { value: best, at: Date.now() });
  return best;
}
