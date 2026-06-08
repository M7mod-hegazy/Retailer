/**
 * Generates the branded NSIS installer graphics (24-bit BMP) from the app logo.
 *
 *   node electron/scripts/make-installer-art.js
 *
 * Outputs:
 *   electron/assets/installerSidebar.bmp   164 x 314  (welcome / finish page)
 *   electron/assets/installerHeader.bmp    150 x 57   (inner page header)
 *
 * Re-run this whenever you replace electron/assets/icon.png with a new logo.
 * NSIS (MUI) requires uncompressed 24-bit BMP, which `sharp` cannot emit, so we
 * render to raw RGB with sharp and pack the BMP ourselves.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ASSETS = path.join(__dirname, "..", "assets");
const LOGO = path.join(ASSETS, "icon.png");

// Brand colors (match the app splash screen).
const BG_TOP = "#0f172a";
const BG_BOTTOM = "#1e293b";
const ACCENT = "#10b981";

function rawRgbToBmp(rgb, width, height) {
  const rowSize = Math.ceil((width * 3) / 4) * 4; // rows padded to 4 bytes
  const pixelBytesSize = rowSize * height;
  const fileSize = 54 + pixelBytesSize;
  const buf = Buffer.alloc(fileSize);

  buf.write("BM", 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10); // pixel data offset
  buf.writeUInt32LE(40, 14); // DIB header size
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22); // positive height => bottom-up rows
  buf.writeUInt16LE(1, 26); // color planes
  buf.writeUInt16LE(24, 28); // bits per pixel
  buf.writeUInt32LE(0, 30); // BI_RGB (no compression)
  buf.writeUInt32LE(pixelBytesSize, 34);
  buf.writeInt32LE(2835, 38); // ~72 DPI
  buf.writeInt32LE(2835, 42);

  let offset = 54;
  for (let y = height - 1; y >= 0; y--) {
    let p = offset;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      buf[p++] = rgb[i + 2]; // B
      buf[p++] = rgb[i + 1]; // G
      buf[p++] = rgb[i]; // R
    }
    offset += rowSize;
  }
  return buf;
}

async function compose(svg, logoSize, logoTop, width, height, out) {
  const bg = Buffer.from(svg);
  const logo = await sharp(LOGO)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const composited = await sharp(bg)
    .composite([{ input: logo, top: logoTop, left: Math.round((width - logoSize) / 2) }])
    .flatten({ background: BG_TOP })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bmp = rawRgbToBmp(composited.data, width, height);
  fs.writeFileSync(out, bmp);
  console.log("wrote", path.relative(process.cwd(), out), `(${width}x${height})`);
}

async function main() {
  if (!fs.existsSync(LOGO)) {
    console.error("Missing logo:", LOGO);
    process.exit(1);
  }

  // Sidebar: 164 x 314
  const sidebarSvg = `<svg width="164" height="314" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${BG_TOP}"/>
        <stop offset="100%" stop-color="${BG_BOTTOM}"/>
      </linearGradient>
    </defs>
    <rect width="164" height="314" fill="url(#g)"/>
    <rect x="0" y="270" width="164" height="3" fill="${ACCENT}" opacity="0.0"/>
    <text x="82" y="232" fill="#f8fafc" font-family="Segoe UI, Arial" font-size="15" font-weight="700" text-anchor="middle">ElHegazi</text>
    <text x="82" y="252" fill="#94a3b8" font-family="Segoe UI, Arial" font-size="11" text-anchor="middle">Retailer</text>
    <rect x="57" y="266" width="50" height="3" rx="2" fill="${ACCENT}"/>
  </svg>`;
  await compose(sidebarSvg, 108, 64, 164, 314, path.join(ASSETS, "installerSidebar.bmp"));

  // Header: 150 x 57 (logo sits to the right, NSIS draws title to the left)
  const headerSvg = `<svg width="150" height="57" xmlns="http://www.w3.org/2000/svg">
    <rect width="150" height="57" fill="#ffffff"/>
  </svg>`;
  await compose(headerSvg, 46, 6, 150, 57, path.join(ASSETS, "installerHeader.bmp"));

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
