const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const https = require("https");

const FUNPLAY_REPO = "FunplayAI/funplay-unreal-mcp";
const FUNPLAY_RELEASES_API = `https://api.github.com/repos/${FUNPLAY_REPO}/releases/latest`;
const FUNPLAY_PLUGIN_NAME = "FunplayMCP";
const FUNPLAY_PLUGIN_MARKER = "FunplayMCP.uplugin";

function getSauronCacheRoot() {
  return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Sauron", "cache");
}

function getFunplayCacheDir() {
  return path.join(getSauronCacheRoot(), "funplay-unreal");
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function findUprojectFile(workspacePath) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved || !fs.existsSync(resolved)) {
    return null;
  }
  const entry = fs.readdirSync(resolved, { withFileTypes: true })
    .find((item) => item.isFile() && item.name.endsWith(".uproject"));
  return entry ? path.join(resolved, entry.name) : null;
}

function fetchJson(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error("too-many-redirects"));
      return;
    }
    const req = https.get(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Sauron-GameDev-Installer",
      },
      timeout: 30000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchJson(res.headers.location, redirectCount + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`github-api-${res.statusCode}`));
        res.resume();
        return;
      }
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("github-api-timeout"));
    });
    req.on("error", reject);
  });
}

function downloadFile(url, destPath, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error("download-too-many-redirects"));
      return;
    }
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);
    const req = https.get(url, {
      headers: { "User-Agent": "Sauron-GameDev-Installer" },
      timeout: 120000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(destPath, () => {});
        downloadFile(res.headers.location, destPath, redirectCount + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(destPath, () => {});
        reject(new Error(`download-${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve(destPath)));
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("download-timeout"));
    });
    req.on("error", (error) => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(error);
    });
  });
}

function expandZipWindows(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const { execFileSync } = require("child_process");
  if (process.platform === "win32") {
    execFileSync("powershell", [
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
    ], { stdio: "ignore", timeout: 180000 });
    return;
  }
  execFileSync("unzip", ["-o", zipPath, "-d", destDir], { stdio: "ignore", timeout: 180000 });
}

function copyDirectoryRecursive(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function findPluginRoot(extractDir) {
  const direct = path.join(extractDir, FUNPLAY_PLUGIN_NAME, FUNPLAY_PLUGIN_MARKER);
  if (fs.existsSync(direct)) {
    return path.join(extractDir, FUNPLAY_PLUGIN_NAME);
  }
  const queue = [extractDir];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const candidate = path.join(current, entry.name);
      if (fs.existsSync(path.join(candidate, FUNPLAY_PLUGIN_MARKER))) {
        return candidate;
      }
      queue.push(candidate);
    }
  }
  return null;
}

async function resolveLatestFunplayReleaseAsset() {
  const release = await fetchJson(FUNPLAY_RELEASES_API);
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const zipAsset = assets.find((asset) => /Funplay\.UnrealMcp.*\.zip$/i.test(String(asset.name || "")))
    || assets.find((asset) => String(asset.name || "").toLowerCase().endsWith(".zip"));
  if (!zipAsset?.browser_download_url) {
    throw new Error("funplay-release-zip-not-found");
  }
  return {
    tag: release.tag_name || "",
    name: zipAsset.name,
    url: zipAsset.browser_download_url,
  };
}

function enablePluginInUproject(uprojectPath, pluginName = FUNPLAY_PLUGIN_NAME) {
  const project = readJsonFile(uprojectPath);
  if (!project) {
    return { ok: false, error: "invalid-uproject" };
  }
  project.Plugins = Array.isArray(project.Plugins) ? project.Plugins : [];
  const existing = project.Plugins.find((entry) => String(entry.Name || entry.name) === pluginName);
  if (existing) {
    existing.Enabled = true;
  } else {
    project.Plugins.push({ Name: pluginName, Enabled: true });
  }
  writeJsonFile(uprojectPath, project);
  return { ok: true, uprojectPath: uprojectPath, enabled: true };
}

function isFunplayPluginInstalled(workspacePath) {
  const pluginRoot = path.join(String(workspacePath || "").trim(), "Plugins", FUNPLAY_PLUGIN_NAME);
  return fs.existsSync(path.join(pluginRoot, FUNPLAY_PLUGIN_MARKER));
}

async function installFunplayMcpPlugin(workspacePath, options = {}) {
  const resolved = String(workspacePath || "").trim();
  const uprojectPath = findUprojectFile(resolved);
  if (!uprojectPath) {
    return { ok: false, skipped: true, reason: "not-unreal-project" };
  }

  const pluginDest = path.join(resolved, "Plugins", FUNPLAY_PLUGIN_NAME);
  if (isFunplayPluginInstalled(resolved) && options.force !== true) {
    const enabled = enablePluginInUproject(uprojectPath, FUNPLAY_PLUGIN_NAME);
    return {
      ok: true,
      skipped: true,
      reason: "plugin-present",
      pluginRoot: pluginDest,
      uproject: enabled,
    };
  }

  const cacheDir = getFunplayCacheDir();
  fs.mkdirSync(cacheDir, { recursive: true });

  let asset;
  try {
    asset = await resolveLatestFunplayReleaseAsset();
  } catch (error) {
    return { ok: false, error: error?.message || "funplay-release-fetch-failed" };
  }

  const zipPath = path.join(cacheDir, asset.name || "Funplay.UnrealMcp.zip");
  const extractDir = path.join(cacheDir, "extract", asset.tag || "latest");

  try {
    if (!fs.existsSync(zipPath) || options.forceDownload === true) {
      await downloadFile(asset.url, zipPath);
    }
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
    expandZipWindows(zipPath, extractDir);
    const pluginSource = findPluginRoot(extractDir);
    if (!pluginSource) {
      return { ok: false, error: "funplay-plugin-root-not-found" };
    }
    if (fs.existsSync(pluginDest)) {
      fs.rmSync(pluginDest, { recursive: true, force: true });
    }
    fs.mkdirSync(path.dirname(pluginDest), { recursive: true });
    copyDirectoryRecursive(pluginSource, pluginDest);
    const enabled = enablePluginInUproject(uprojectPath, FUNPLAY_PLUGIN_NAME);
    return {
      ok: true,
      skipped: false,
      reason: "plugin-installed",
      pluginRoot: pluginDest,
      release: asset.tag,
      uproject: enabled,
    };
  } catch (error) {
    return { ok: false, error: error?.message || "funplay-install-failed" };
  }
}

module.exports = {
  FUNPLAY_PLUGIN_NAME,
  FUNPLAY_RELEASES_API,
  getFunplayCacheDir,
  findUprojectFile,
  enablePluginInUproject,
  isFunplayPluginInstalled,
  installFunplayMcpPlugin,
  resolveLatestFunplayReleaseAsset,
  findPluginRoot,
};
