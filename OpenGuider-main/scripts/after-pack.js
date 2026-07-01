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
  } catch (error) {
    throw new Error(
      `rcedit is required to embed the Sauron icon in ${context.packager.appInfo.productFilename}.exe. Install devDependencies before building.`,
      { cause: error },
    );
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

module.exports = async (context) => {
  await setWindowsExecutableMetadata(context);
};
