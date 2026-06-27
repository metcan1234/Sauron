const fs = require("fs");
const path = require("path");

function readAuthorName(pkg) {
  if (!pkg?.author) {
    return "";
  }
  if (typeof pkg.author === "string") {
    return pkg.author;
  }
  return pkg.author.name || "";
}

function toVersionQuad(version) {
  const parts = String(version || "0.0.0")
    .split(".")
    .map((part) => parseInt(part, 10) || 0);
  while (parts.length < 4) {
    parts.push(0);
  }
  return parts.slice(0, 4).join(".");
}

async function setWindowsExecutableMetadata(context) {
  if (context?.electronPlatformName !== "win32") {
    return;
  }

  let rcedit;
  try {
    ({ rcedit } = require("rcedit"));
  } catch (_error) {
    // Skip metadata mutation when rcedit is unavailable.
    return;
  }

  const projectDir = context.packager.projectDir;
  const pkgPath = path.join(projectDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const authorName = readAuthorName(pkg);
  const productName = context.packager.appInfo.productName || pkg.build?.productName || "Sauron";
  const productFilename = context.packager.appInfo.productFilename || productName;
  const executablePath = path.join(context.appOutDir, `${productFilename}.exe`);
  const iconPath = path.join(projectDir, "renderer", "assets", "logo.ico");
  const copyright = context.packager.appInfo.copyright || pkg.build?.copyright || `Copyright © ${authorName}`;
  const versionQuad = toVersionQuad(pkg.version);

  await rcedit(executablePath, {
    icon: iconPath,
    "file-version": versionQuad,
    "product-version": versionQuad,
    "version-string": {
      CompanyName: authorName,
      ProductName: productName,
      FileDescription: pkg.description || productName,
      LegalCopyright: copyright,
      OriginalFilename: `${productFilename}.exe`,
      InternalName: productFilename,
    },
  });
}

function ensurePackagedGamedevMcp(context) {
  if (context?.electronPlatformName !== "win32") {
    return;
  }

  const productName = context.packager.appInfo.productFilename
    || context.packager.appInfo.productName
    || "Sauron";
  const resourcesDir = path.join(context.appOutDir, "resources");
  const gamedevEntry = path.join(resourcesDir, "gamedev-all-in-one", "dist", "index.js");
  if (!fs.existsSync(gamedevEntry)) {
    throw new Error(
      `Packaged Game Dev MCP missing: ${gamedevEntry}. `
      + "Run ensureGamedevMcpBuilt (npm run predist:win) before electron-builder.",
    );
  }
  console.log(`Packaged Game Dev MCP OK: ${gamedevEntry}`);
}

module.exports = async (context) => {
  ensurePackagedGamedevMcp(context);
  await setWindowsExecutableMetadata(context);
};
