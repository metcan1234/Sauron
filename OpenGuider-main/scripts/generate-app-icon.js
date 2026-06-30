const fs = require("fs");
const path = require("path");
const os = require("os");
const sharp = require("sharp");

const projectRoot = path.resolve(__dirname, "..");
const assetsDir = path.join(projectRoot, "renderer", "assets");
const icoPath = path.join(assetsDir, "logo.ico");
const openSourcePath = path.join(assetsDir, "logo-source-open.png");
const framesSourcePath = path.join(assetsDir, "logo-source-frames.png");
const legacySourcePath = path.join(assetsDir, "logo-source.png");
const OUTPUT_SIZE = 1024;
const EYE_CLIP = { cx: 512, cy: 512, rx: 440, ry: 230 };

const PNG_BLINK_FRAMES = [
  { png: "logo.png", kind: "open" },
  { png: "blink-75.png", kind: "overlay", openRatio: 0.75 },
  { png: "half-opened.png", kind: "overlay", openRatio: 0.5 },
  { png: "blink-25.png", kind: "overlay", openRatio: 0.25 },
  { png: "full-closed.png", kind: "closed" },
];

function distFromCenter(x, y, width, height) {
  const dx = (x - width / 2) / (width / 2);
  const dy = (y - height / 2) / (height / 2);
  return Math.sqrt(dx * dx + dy * dy);
}

function isWarmPixel(r, g, b) {
  const warmth = r - b;
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const saturation = maxC === 0 ? 0 : (maxC - minC) / maxC;
  const brightness = (r + g + b) / 3;
  return (
    (warmth > 18 && r > 62 && saturation > 0.12) ||
    (brightness > 120 && saturation > 0.08 && warmth > 0) ||
    (warmth > 10 && r > 48 && g > 28 && saturation > 0.18)
  );
}

function isBackgroundSeed(r, g, b) {
  const brightness = (r + g + b) / 3;
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const saturation = maxC === 0 ? 0 : (maxC - minC) / maxC;
  const warmth = r - b;
  if (isWarmPixel(r, g, b)) {
    return false;
  }
  return brightness < 48 && saturation < 0.28 && warmth < 22;
}

function canBackgroundSpread(r, g, b) {
  if (isWarmPixel(r, g, b)) {
    return false;
  }
  const brightness = (r + g + b) / 3;
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const saturation = maxC === 0 ? 0 : (maxC - minC) / maxC;
  const warmth = r - b;
  return brightness < 62 && saturation < 0.32 && warmth < 28;
}

async function floodRemoveBackground(inputBuffer) {
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  for (let x = 0; x < width; x += 1) {
    for (const y of [0, height - 1]) {
      const idx = y * width + x;
      const i = idx * 4;
      if (isBackgroundSeed(data[i], data[i + 1], data[i + 2])) {
        visited[idx] = 1;
        queue.push(idx);
      }
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (const x of [0, width - 1]) {
      const idx = y * width + x;
      if (visited[idx]) {
        continue;
      }
      const i = idx * 4;
      if (isBackgroundSeed(data[i], data[i + 1], data[i + 2])) {
        visited[idx] = 1;
        queue.push(idx);
      }
    }
  }

  while (queue.length > 0) {
    const idx = queue.pop();
    const i = idx * 4;
    data[i + 3] = 0;

    const x = idx % width;
    const y = (idx - x) / width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }
      const nidx = ny * width + nx;
      if (visited[nidx]) {
        continue;
      }
      const ni = nidx * 4;
      if (canBackgroundSpread(data[ni], data[ni + 1], data[ni + 2])) {
        visited[nidx] = 1;
        queue.push(nidx);
      }
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) {
        continue;
      }
      const centerDist = distFromCenter(x, y, width, height);
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = (r + g + b) / 3;

      if (centerDist > 0.62 && brightness < 55 && !isWarmPixel(r, g, b)) {
        data[i + 3] = 0;
      } else if (centerDist > 0.72 && brightness < 80 && !isWarmPixel(r, g, b)) {
        const fade = Math.min(1, (centerDist - 0.62) / 0.2);
        data[i + 3] = Math.round(data[i + 3] * (1 - fade));
      }
    }
  }

  return sharp(data, {
    raw: { width, height, channels: 4 },
  }).png().toBuffer();
}

async function trimAndSquare(sourceBuffer) {
  const trimmed = await sharp(sourceBuffer)
    .trim({ threshold: 12 })
    .png()
    .toBuffer();

  return sharp(trimmed)
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function applyCircularMask(sourceBuffer, radiusRatio = 0.42) {
  const { data, info } = await sharp(sourceBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const cx = width / 2;
  const cy = height / 2;
  const radius = (Math.min(width, height) * radiusRatio) / 2;
  const feather = Math.max(6, radius * 0.06);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const i = (y * width + x) * 4;

      if (dist > radius) {
        data[i + 3] = 0;
      } else if (dist > radius - feather) {
        const fade = (radius - dist) / feather;
        data[i + 3] = Math.round(data[i + 3] * fade);
      }
    }
  }

  return sharp(data, {
    raw: { width, height, channels: 4 },
  }).png().toBuffer();
}

async function buildSquareLogoBase(sourceBuffer, { circularMask = false } = {}) {
  let cleaned = await floodRemoveBackground(sourceBuffer);
  if (circularMask) {
    cleaned = await applyCircularMask(cleaned, 0.88);
  }
  return trimAndSquare(cleaned);
}

async function buildClosedLogoBase(sourceBuffer) {
  let masked = await applyCircularMask(sourceBuffer, 0.9);
  const { data, info } = await sharp(masked)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) {
        continue;
      }
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const centerDist = distFromCenter(x, y, width, height);
      const isOuterBlack = brightness < 16 && centerDist > 0.42;
      const isBackgroundBlack = brightness < 10 && centerDist > 0.34;

      if (isBackgroundBlack) {
        data[i + 3] = 0;
      } else if (isOuterBlack) {
        data[i + 3] = Math.round(data[i + 3] * Math.max(0, 1 - (centerDist - 0.34) / 0.18));
      }
    }
  }

  masked = await sharp(data, {
    raw: { width, height, channels: 4 },
  }).png().toBuffer();

  return trimAndSquare(masked);
}

async function extractClosedFrame(sourcePath) {
  const meta = await sharp(sourcePath).metadata();
  const panelWidth = meta.width / 3;
  const panelIndex = 2;
  const centerX = Math.round(panelIndex * panelWidth + panelWidth / 2);
  const centerY = Math.round(meta.height * 0.49);
  const cropSize = Math.round(meta.width * 0.34);
  const left = Math.max(0, centerX - Math.floor(cropSize / 2));
  const top = Math.max(0, centerY - Math.floor(cropSize / 2));

  const cropped = await sharp(sourcePath)
    .extract({
      left,
      top,
      width: Math.min(cropSize, meta.width - left),
      height: Math.min(cropSize, meta.height - top),
    })
    .png()
    .toBuffer();

  return buildClosedLogoBase(cropped);
}

function buildSmokyEyelidOverlaySvg(openRatio) {
  const clamped = Math.max(0.04, Math.min(1, openRatio));
  const coverRatio = (1 - clamped) * 0.54;
  const lidHeight = Math.round(EYE_CLIP.ry * 2 * coverRatio);
  const midY = EYE_CLIP.cy;
  const visibleHalf = EYE_CLIP.ry * clamped;
  const topEnd = Math.max(EYE_CLIP.cy - EYE_CLIP.ry, Math.round(midY - visibleHalf));
  const bottomStart = Math.min(EYE_CLIP.cy + EYE_CLIP.ry, Math.round(midY + visibleHalf));
  const clipLeft = EYE_CLIP.cx - EYE_CLIP.rx;
  const clipWidth = EYE_CLIP.rx * 2;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${OUTPUT_SIZE}" height="${OUTPUT_SIZE}" viewBox="0 0 ${OUTPUT_SIZE} ${OUTPUT_SIZE}">
    <defs>
      <clipPath id="eyeClip">
        <ellipse cx="${EYE_CLIP.cx}" cy="${EYE_CLIP.cy}" rx="${EYE_CLIP.rx}" ry="${EYE_CLIP.ry}"/>
      </clipPath>
      <linearGradient id="topLid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0a0706" stop-opacity="0.98"/>
        <stop offset="55%" stop-color="#1a0f0a" stop-opacity="0.92"/>
        <stop offset="85%" stop-color="#2a1810" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#2a1810" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="bottomLid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2a1810" stop-opacity="0"/>
        <stop offset="15%" stop-color="#2a1810" stop-opacity="0.55"/>
        <stop offset="45%" stop-color="#1a0f0a" stop-opacity="0.92"/>
        <stop offset="100%" stop-color="#0a0706" stop-opacity="0.98"/>
      </linearGradient>
      <filter id="smoke" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="8"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.05  0 0 0 0 0.03  0 0 0 0 0.02  0 0 0 0.35 0"/>
        <feBlend in="SourceGraphic" mode="multiply"/>
      </filter>
    </defs>
    <g clip-path="url(#eyeClip)">
      <rect x="${clipLeft}" y="${EYE_CLIP.cy - EYE_CLIP.ry}" width="${clipWidth}" height="${topEnd + lidHeight - (EYE_CLIP.cy - EYE_CLIP.ry)}" fill="url(#topLid)" filter="url(#smoke)"/>
      <rect x="${clipLeft}" y="${bottomStart - lidHeight}" width="${clipWidth}" height="${EYE_CLIP.cy + EYE_CLIP.ry - (bottomStart - lidHeight)}" fill="url(#bottomLid)" filter="url(#smoke)"/>
      <rect x="${clipLeft}" y="${EYE_CLIP.cy - EYE_CLIP.ry}" width="${clipWidth}" height="${topEnd - (EYE_CLIP.cy - EYE_CLIP.ry)}" fill="#0a0706" opacity="0.88"/>
      <rect x="${clipLeft}" y="${bottomStart}" width="${clipWidth}" height="${EYE_CLIP.cy + EYE_CLIP.ry - bottomStart}" fill="#0a0706" opacity="0.88"/>
    </g>
  </svg>`);
}

async function applyBaseAlphaMask(baseBuffer, composedBuffer) {
  const baseRaw = await sharp(baseBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const composed = await sharp(composedBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = baseRaw.info;

  for (let i = 0; i < baseRaw.data.length; i += 4) {
    const baseAlpha = baseRaw.data[i + 3];
    if (baseAlpha === 0) {
      composed.data[i] = 0;
      composed.data[i + 1] = 0;
      composed.data[i + 2] = 0;
      composed.data[i + 3] = 0;
    } else {
      composed.data[i + 3] = Math.min(composed.data[i + 3], baseAlpha);
    }
  }

  return sharp(composed.data, {
    raw: { width, height, channels: 4 },
  }).png().toBuffer();
}

async function renderOverlayFrame(baseBuffer, openRatio, pngPath) {
  const overlay = buildSmokyEyelidOverlaySvg(openRatio);
  const overlayBuffer = await sharp(overlay).png().toBuffer();
  const composedBuffer = await sharp(baseBuffer)
    .composite([{ input: overlayBuffer, top: 0, left: 0 }])
    .png()
    .toBuffer();
  const maskedBuffer = await applyBaseAlphaMask(baseBuffer, composedBuffer);
  await sharp(maskedBuffer).png().toFile(pngPath);
}

async function writeBufferToPng(buffer, pngPath) {
  await sharp(buffer).png().toFile(pngPath);
}

async function generateFromUserSources() {
  const logoPath = path.join(assetsDir, "logo.png");
  const openBuffer = fs.existsSync(logoPath)
    ? await fs.promises.readFile(logoPath)
    : await buildSquareLogoBase(await fs.promises.readFile(openSourcePath));

  if (!fs.existsSync(logoPath)) {
    await writeBufferToPng(openBuffer, logoPath);
    console.log(`Wrote ${logoPath} (open)`);
  } else {
    console.log(`Kept ${logoPath} unchanged`);
  }

  const closedBuffer = fs.existsSync(framesSourcePath)
    ? await extractClosedFrame(framesSourcePath)
    : openBuffer;

  for (const frame of PNG_BLINK_FRAMES) {
    if (frame.kind === "open") {
      continue;
    }

    const pngPath = path.join(assetsDir, frame.png);

    if (frame.kind === "closed") {
      await writeBufferToPng(closedBuffer, pngPath);
    } else if (frame.kind === "overlay") {
      await renderOverlayFrame(openBuffer, frame.openRatio, pngPath);
    }

    console.log(`Wrote ${pngPath} (${frame.kind})`);
  }
}

async function writeIcoFromLogoPng() {
  const pngPath = path.join(assetsDir, "logo.png");
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

  console.log(`Wrote ${icoPath} (${buffer.length} bytes) from logo.png`);
}

async function main() {
  if (!fs.existsSync(openSourcePath) && fs.existsSync(legacySourcePath)) {
    await fs.promises.copyFile(legacySourcePath, openSourcePath);
  }

  if (!fs.existsSync(openSourcePath)) {
    console.error(`Open logo source not found: ${openSourcePath}`);
    process.exit(1);
  }

  await generateFromUserSources();
  await writeIcoFromLogoPng();
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
