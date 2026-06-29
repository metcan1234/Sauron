const fs = require("fs");
const path = require("path");
const os = require("os");
const sharp = require("sharp");

const projectRoot = path.resolve(__dirname, "..");
const pngPath = path.join(projectRoot, "renderer", "assets", "logo.png");
const icoPath = path.join(projectRoot, "renderer", "assets", "logo.ico");

async function main() {
  if (!fs.existsSync(pngPath)) {
    console.error(`Source PNG not found: ${pngPath}`);
    process.exit(1);
  }

  const meta = await sharp(pngPath).metadata();
  const cropSize = Math.min(meta.width || 0, meta.height || 0);
  if (!cropSize) {
    console.error("Could not read logo.png dimensions");
    process.exit(1);
  }

  const left = Math.floor(((meta.width || 0) - cropSize) / 2);
  const top = Math.floor(((meta.height || 0) - cropSize) / 2);
  const tempPng = path.join(os.tmpdir(), `sauron-logo-square-${process.pid}.png`);

  await sharp(pngPath)
    .extract({ left, top, width: cropSize, height: cropSize })
    .resize(256, 256)
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

  console.log(
    `Wrote ${icoPath} (${buffer.length} bytes) from ${pngPath} (${meta.width}x${meta.height} → 256x256 square)`,
  );
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
