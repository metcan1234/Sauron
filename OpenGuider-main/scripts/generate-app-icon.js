const fs = require("fs");
const path = require("path");
const os = require("os");
const sharp = require("sharp");

const projectRoot = path.resolve(__dirname, "..");
const svgPath = path.join(projectRoot, "renderer", "assets", "logo.svg");
const pngPath = path.join(projectRoot, "renderer", "assets", "logo.png");
const icoPath = path.join(projectRoot, "renderer", "assets", "logo.ico");

async function renderSourcePng(targetPath, size = 512) {
  if (fs.existsSync(svgPath)) {
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(targetPath);
    return { source: svgPath, size };
  }

  if (!fs.existsSync(pngPath)) {
    throw new Error(`Neither ${svgPath} nor ${pngPath} found`);
  }

  const meta = await sharp(pngPath).metadata();
  const cropSize = Math.min(meta.width || 0, meta.height || 0);
  if (!cropSize) {
    throw new Error("Could not read logo.png dimensions");
  }
  const left = Math.floor(((meta.width || 0) - cropSize) / 2);
  const top = Math.floor(((meta.height || 0) - cropSize) / 2);
  await sharp(pngPath)
    .extract({ left, top, width: cropSize, height: cropSize })
    .resize(size, size)
    .png()
    .toFile(targetPath);
  return { source: pngPath, size };
}

async function main() {
  const tempPng = path.join(os.tmpdir(), `sauron-logo-square-${process.pid}.png`);
  const rendered = await renderSourcePng(tempPng, 512);
  await sharp(tempPng).resize(256, 256).png().toFile(pngPath);

  const pngToIco = (await import("png-to-ico")).default;
  const buffer = await pngToIco(tempPng);
  fs.writeFileSync(icoPath, buffer);

  try {
    fs.unlinkSync(tempPng);
  } catch {
    // ignore temp cleanup failures
  }

  console.log(
    `Wrote ${pngPath} and ${icoPath} (${buffer.length} bytes) from ${rendered.source} (${rendered.size}x${rendered.size})`,
  );
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
