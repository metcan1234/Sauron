const fs = require("fs");
const path = require("path");
const os = require("os");
const sharp = require("sharp");

const projectRoot = path.resolve(__dirname, "..");
const assetsDir = path.join(projectRoot, "renderer", "assets");
const icoPath = path.join(assetsDir, "logo.ico");
const logoSourcePath = path.join(assetsDir, "logo-source.png");
const OUTPUT_SIZE = 1024;

const LOGO_SOURCES = [
  { svg: "logo.svg", png: "logo.png", size: OUTPUT_SIZE },
  { svg: "logo-blink-75.svg", png: "blink-75.png", size: OUTPUT_SIZE },
  { svg: "logo-blink-half.svg", png: "half-opened.png", size: OUTPUT_SIZE },
  { svg: "logo-blink-25.svg", png: "blink-25.png", size: OUTPUT_SIZE },
  { svg: "logo-blink-closed.svg", png: "full-closed.png", size: OUTPUT_SIZE },
];

const PNG_BLINK_FRAMES = [
  { png: "logo.png", openRatio: 1 },
  { png: "blink-75.png", openRatio: 0.75 },
  { png: "half-opened.png", openRatio: 0.5 },
  { png: "blink-25.png", openRatio: 0.25 },
  { png: "full-closed.png", openRatio: 0.04 },
];

async function renderSvgToPng(svgPath, pngPath, size) {
  await sharp(svgPath, { density: 450 })
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(pngPath);
}

async function buildSquareLogoBase(sourcePath) {
  return sharp(sourcePath)
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
      fit: "contain",
      background: { r: 12, g: 10, b: 10, alpha: 1 },
    })
    .png()
    .toBuffer();
}

function buildEyelidOverlaySvg(openRatio) {
  const clamped = Math.max(0.02, Math.min(1, openRatio));
  const coverRatio = (1 - clamped) * 0.52;
  const lidHeight = Math.round(OUTPUT_SIZE * coverRatio);
  const midY = OUTPUT_SIZE / 2;
  const visibleHalf = (OUTPUT_SIZE * clamped) / 2;
  const topEnd = Math.max(0, Math.round(midY - visibleHalf));
  const bottomStart = Math.min(OUTPUT_SIZE, Math.round(midY + visibleHalf));

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${OUTPUT_SIZE}" height="${OUTPUT_SIZE}" viewBox="0 0 ${OUTPUT_SIZE} ${OUTPUT_SIZE}">
    <defs>
      <linearGradient id="topLid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#050505" stop-opacity="1"/>
        <stop offset="70%" stop-color="#120a06" stop-opacity="0.98"/>
        <stop offset="100%" stop-color="#050505" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="bottomLid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#050505" stop-opacity="0"/>
        <stop offset="30%" stop-color="#120a06" stop-opacity="0.98"/>
        <stop offset="100%" stop-color="#050505" stop-opacity="1"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${OUTPUT_SIZE}" height="${topEnd + lidHeight}" fill="url(#topLid)"/>
    <rect x="0" y="${bottomStart - lidHeight}" width="${OUTPUT_SIZE}" height="${OUTPUT_SIZE - bottomStart + lidHeight}" fill="url(#bottomLid)"/>
    <rect x="0" y="0" width="${OUTPUT_SIZE}" height="${topEnd}" fill="#050505"/>
    <rect x="0" y="${bottomStart}" width="${OUTPUT_SIZE}" height="${OUTPUT_SIZE - bottomStart}" fill="#050505"/>
  </svg>`);
}

async function renderBlinkFrameFromSource(baseBuffer, openRatio, pngPath) {
  const overlay = buildEyelidOverlaySvg(openRatio);
  await sharp(baseBuffer)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png()
    .toFile(pngPath);
}

async function generateFromPngSource() {
  const baseBuffer = await buildSquareLogoBase(logoSourcePath);
  for (const frame of PNG_BLINK_FRAMES) {
    const pngPath = path.join(assetsDir, frame.png);
    await renderBlinkFrameFromSource(baseBuffer, frame.openRatio, pngPath);
    console.log(`Wrote ${pngPath} from logo-source.png (open=${frame.openRatio})`);
  }
}

async function generateFromSvgSources() {
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
}

async function writeIcoFromLogoPng() {
  const pngPath = path.join(assetsDir, "logo.png");
  const tempPng = path.join(os.tmpdir(), `sauron-logo-square-${process.pid}.png`);
  await sharp(pngPath)
    .resize(256, 256, {
      fit: "contain",
      background: { r: 12, g: 10, b: 10, alpha: 1 },
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

  console.log(`Wrote ${icoPath} (${buffer.length} bytes) from logo.png`);
}

async function main() {
  if (fs.existsSync(logoSourcePath)) {
    await generateFromPngSource();
  } else {
    await generateFromSvgSources();
  }
  await writeIcoFromLogoPng();
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
