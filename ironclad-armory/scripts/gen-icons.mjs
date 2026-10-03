#!/usr/bin/env node
/**
 * Generates the mark-armour PWA icon set from one hand-drawn SVG source.
 *
 * The "MA" monogram is pure vector geometry (no <text>, so no font is needed
 * on the machine that runs this script):
 *   - M = two full-height stems + a chevron (V) whose top edges line up
 *     exactly with the stems, leaving the classic three counters.
 *   - A = solid triangle with an even-odd counter (hole) and a foot opening
 *     below the crossbar.
 *
 * Outputs (all in public/):
 *   icons/icon-192.png            PWA icon, rounded dark tile
 *   icons/icon-512.png            PWA icon, rounded dark tile
 *   icons/maskable-512.png        full-bleed bg, ~20% safe padding
 *   icons/apple-touch-icon-180.png full-bleed (iOS applies its own mask)
 *   icons/icon-64.png, icon-32.png favicon-sized tiles
 *   favicon.ico                   32x32 PNG-in-ICO (browsers accept PNG entries)
 *
 * Run: node scripts/gen-icons.mjs
 */
import { mkdir, writeFile, stat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ICONS_DIR = path.join(ROOT, "public", "icons");
const PUBLIC_DIR = path.join(ROOT, "public");

const ORANGE = "#f59e0b"; // blaze-500
const INK = "#070908"; // ink-950

/** "MA" monogram drawn in a 512x512 coordinate space. */
function monogram() {
  return `<g transform="translate(-4 0)" fill="${ORANGE}">
      <!-- M: left stem, right stem, V (top edges align with the stems) -->
      <rect x="96" y="176" width="36" height="160"/>
      <rect x="210" y="176" width="36" height="160"/>
      <path d="M96 176 L132 176 L171 259 L210 176 L246 176 L171 336 Z"/>
      <!-- A: outer triangle, counter above the crossbar, opening below it -->
      <path fill-rule="evenodd" d="M341 176 L424 336 L258 336 Z M341 245 L359 280 L323 280 Z M310 306 L372 306 L388 336 L294 336 Z"/>
    </g>`;
}

function glowDef() {
  return `<radialGradient id="g" cx="50%" cy="46%" r="62%">
        <stop offset="0%" stop-color="${ORANGE}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${ORANGE}" stop-opacity="0"/>
      </radialGradient>`;
}

/**
 * @param {"rounded" | "maskable" | "apple"} mode
 * @param {number} size    pixel width/height of the output
 * @param {number} artScale scale of the monogram (1 = as drawn)
 */
function buildSvg(mode, size, artScale = 1) {
  const art = `<g transform="translate(256 256) scale(${artScale}) translate(-256 -256)">${monogram()}</g>`;
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
      <defs>${glowDef()}</defs>`;

  if (mode === "maskable") {
    // Full-bleed background (no rounding — the OS masks it), art inside the
    // ~20% safe zone so nothing important gets clipped.
    return `${head}
      <rect width="512" height="512" fill="${INK}"/>
      <rect width="512" height="512" fill="url(#g)"/>
      ${art}
    </svg>`;
  }

  if (mode === "apple") {
    // iOS masks apple-touch-icons itself; keep the art comfortably inside.
    return `${head}
      <rect width="512" height="512" fill="${INK}"/>
      <rect width="512" height="512" fill="url(#g)"/>
      ${art}
    </svg>`;
  }

  // Rounded dark tile with a subtle brand border (matches the site's MA logo).
  return `${head}
      <rect width="512" height="512" rx="112" fill="${INK}"/>
      <rect width="512" height="512" rx="112" fill="url(#g)"/>
      <rect x="14" y="14" width="484" height="484" rx="100" fill="none" stroke="${ORANGE}" stroke-opacity="0.45" stroke-width="8"/>
      ${art}
    </svg>`;
}

async function render(mode, size, artScale, outFile) {
  const svg = buildSvg(mode, size, artScale);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outFile);
  return outFile;
}

/** Minimal ICO wrapper around one PNG entry (PNG-compressed icons are valid ICO). */
function pngToIco(pngBuffer) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0); // width
  entry.writeUInt8(32, 1); // height
  entry.writeUInt8(0, 2); // palette colors
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12); // offset: 6 (header) + 16 (entry)
  return Buffer.concat([header, entry, pngBuffer]);
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function main() {
  await mkdir(ICONS_DIR, { recursive: true });

  const jobs = [
    ["rounded", 192, 1, path.join(ICONS_DIR, "icon-192.png")],
    ["rounded", 512, 1, path.join(ICONS_DIR, "icon-512.png")],
    ["maskable", 512, 0.88, path.join(ICONS_DIR, "maskable-512.png")],
    ["apple", 180, 0.86, path.join(ICONS_DIR, "apple-touch-icon-180.png")],
    ["rounded", 64, 1.08, path.join(ICONS_DIR, "icon-64.png")],
    ["rounded", 32, 1.15, path.join(ICONS_DIR, "icon-32.png")],
  ];

  for (const [mode, size, scale, out] of jobs) {
    await render(mode, size, scale, out);
  }

  // favicon.ico (32x32 PNG entry) — only because src/app has no icon.tsx/favicon.
  const icoPath = path.join(PUBLIC_DIR, "favicon.ico");
  const png32 = await sharp(Buffer.from(buildSvg("rounded", 32, 1.15)))
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(icoPath, pngToIco(png32));

  // ── Verify ──────────────────────────────────────────────────────────
  const mustBeBig = jobs.filter(([, size]) => size >= 180).map(([, , , out]) => out);
  const all = [...jobs.map(([, , , out]) => out), icoPath];
  let failed = false;

  for (const file of all) {
    const { size } = await stat(file);
    const buf = await readFile(file);
    const head = buf.subarray(0, 8);

    const isPng = head.equals(PNG_MAGIC);
    const isIco = file.endsWith(".ico")
      ? head.readUInt16LE(0) === 0 && head.readUInt16LE(2) === 1
      : true;
    const bigEnough = mustBeBig.includes(file) ? size > 2048 : size > 300;

    const ok = (file.endsWith(".ico") ? isIco : isPng) && bigEnough;
    if (!ok) failed = true;
    console.log(
      `${ok ? "OK  " : "FAIL"} ${path.relative(ROOT, file).replace(/\\/g, "/")} — ${size} bytes` +
        (file.endsWith(".ico") ? " (ICO)" : isPng ? " (PNG magic ok)" : " (BAD MAGIC)"),
    );
  }

  if (failed) {
    console.error("Icon verification failed.");
    process.exitCode = 1;
  } else {
    console.log("All icons generated and verified.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
