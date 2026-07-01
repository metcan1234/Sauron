const fs = require("fs");
const path = require("path");

function getSelfProfileFilePath(userDataPath, personaId = "luna") {
  const safeId = personaId === "hiri" ? "hiri" : "luna";
  return path.join(String(userDataPath || ""), `${safeId}-self-profile.json`);
}

function syncPersonaSelfProfileToFile(userDataPath, personaId, profile = {}) {
  const filePath = getSelfProfileFilePath(userDataPath, personaId);
  if (!userDataPath || !filePath) {
    return { ok: false, path: filePath };
  }
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const payload = {
      personaId,
      syncedAt: new Date().toISOString(),
      profile,
    };
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return { ok: true, path: filePath };
  } catch (error) {
    return { ok: false, path: filePath, error: error?.message || String(error) };
  }
}

module.exports = {
  getSelfProfileFilePath,
  syncPersonaSelfProfileToFile,
};
