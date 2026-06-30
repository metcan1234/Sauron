const fs = require("fs");
const path = require("path");
const os = require("os");
const sharp = require("sharp");

const projectRoot = path.resolve(__dirname, "..");
const assetsDir = path.join(projectRoot, "renderer", "assets");
const icoPath = path.join(assetsDir, "logo.ico");

const LOGO_SOURCES = [
  { svg: "logo-eye.svg", png: "logo.png", size: 512 },
  { svg: "logo-eye-half.svg", png: "half-opened.png", size: 512 },
  { svg: "logo-eye-closed.svg", png: "full-closed.png", size: 512 },
];

async function renderSvgToPng(svgPath, pngPath, size) {
  await sharp(svgPath, { density: 300 })
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(pngPath);
}

async function main() {
  for (const entry of LOGO_SOURCES) {
    const svgPath = path.join(assetsDir, entry.svg);
    const pngPath = path.join(assetsDir, entry.png);
    if (!fs.existsSync(svgPath)) {
      console.error(`SVG not found: ${svgPath}`);
      process.exit(1);
    }
    await renderSvgToPng(svgPath, pngPath, entry.size);
    console.log(`Wrote ${pngPath} from ${entry.svg} (${entry.size}x${entry.size})`);
  }

  const pngPath = path.join(assetsDir, "logo.png");
  const meta = await sharp(pngPath).metadata();
  const cropSize = Math.min(meta.width || 0, meta.height || 0);
  if (!cropSize) {
    console.error("Could not read logo.png dimensions");
    process.exit(1);
  }

  const tempPng = path.join(os.tmpdir(), `sauron-logo-square-${process.pid}.png`);
  await sharp(pngPath)
    .resize(256, 256, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(tempPng);

  const pngToIco = (await import("png-to-ico")).default;
  const buffer = await pngToIco(tempPng);
  fs.writeFileSync(icoPath, buffer);

  try {
    fs.unlinkSync(tempPng);
  } catch {
    // ignore temp cleanup failures
  }

  console.log(`Wrote ${icoPath} (${buffer.length} bytes) from logo-eye.svg`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
