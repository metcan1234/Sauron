const path = require("path");

async function setWindowsExecutableIcon(context) {
  if (context?.electronPlatformName !== "win32") {
    return;
  }

  let rcedit;
  try {
    ({ rcedit } = require("rcedit"));
  } catch (_error) {
    // Skip icon mutation when rcedit is unavailable.
    return;
  }

  const executableName = `${context.packager.appInfo.productFilename}.exe`;
  const executablePath = path.join(context.appOutDir, executableName);
  const iconPath = path.join(context.packager.projectDir, "renderer", "assets", "logo.ico");

  // Use rcedit directly after pack because signAndEditExecutable is disabled.
  await rcedit(executablePath, { icon: iconPath });
}

module.exports = async (context) => {
  await setWindowsExecutableIcon(context);
};
