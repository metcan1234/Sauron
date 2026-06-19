const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const REQUEST_FILENAME = "cline-credential-request.json";
const PAYLOAD_PREFIX = "sauron-cline-creds-";
const DEFAULT_TTL_MS = 60_000;
const SYNC_KEY_DIR = path.join(os.homedir(), ".sauron");
const SYNC_KEY_FILE = path.join(SYNC_KEY_DIR, "cline-sync.key");

function getSauronDir(workspacePath) {
  return path.join(workspacePath, ".sauron");
}

function getOrCreateSyncKey() {
  if (fs.existsSync(SYNC_KEY_FILE)) {
    const existing = fs.readFileSync(SYNC_KEY_FILE);
    if (existing.length >= 32) {
      return existing.subarray(0, 32);
    }
  }
  fs.mkdirSync(SYNC_KEY_DIR, { recursive: true });
  const key = crypto.randomBytes(32);
  fs.writeFileSync(SYNC_KEY_FILE, key, { mode: 0o600 });
  return key;
}

function encryptPayloadObject(payload) {
  const key = getOrCreateSyncKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

function decryptPayloadBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 28) {
    return null;
  }
  const key = getOrCreateSyncKey();
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

function mapSettingsToClinePayload(settings = {}) {
  const payload = {};
  const gemini = String(settings.geminiApiKey || "").trim();
  const deepseek = String(settings.deepseekApiKey || "").trim();
  const openai = String(settings.openaiApiKey || "").trim();
  const ollama = String(settings.ollamaUrl || "").trim();

  if (gemini) payload.geminiApiKey = gemini;
  if (deepseek) payload.deepSeekApiKey = deepseek;
  if (openai) payload.openAiApiKey = openai;
  if (ollama) payload.ollamaBaseUrl = ollama;

  return payload;
}

function listConfiguredProviders(payload = {}) {
  const configured = [];
  if (payload.geminiApiKey) configured.push("gemini");
  if (payload.deepSeekApiKey) configured.push("deepseek");
  if (payload.openAiApiKey) configured.push("openai");
  if (payload.ollamaBaseUrl) configured.push("ollama");
  return configured;
}

function writeEncryptedPayload(payload, { ttlMs = DEFAULT_TTL_MS } = {}) {
  if (!payload || Object.keys(payload).length === 0) {
    return null;
  }

  const nonce = crypto.randomUUID();
  const tempPath = path.join(os.tmpdir(), `${PAYLOAD_PREFIX}${nonce}.enc`);
  const encrypted = encryptPayloadObject(payload);
  fs.writeFileSync(tempPath, encrypted, { mode: 0o600 });

  return {
    nonce,
    tempPath,
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    configuredProviders: listConfiguredProviders(payload),
  };
}

function writeCredentialRequest(workspacePath, meta, { settings } = {}) {
  const resolvedPath = String(workspacePath || "").trim();
  if (!resolvedPath) {
    return { ok: false, error: "Workspace path is not configured." };
  }

  const payload = mapSettingsToClinePayload(settings);
  if (Object.keys(payload).length === 0) {
    return { ok: false, error: "No API credentials configured in Sauron settings." };
  }

  const requestMeta = meta || writeEncryptedPayload(payload);
  if (!requestMeta) {
    return { ok: false, error: "Credential payload could not be created." };
  }

  const sauronDir = getSauronDir(resolvedPath);
  fs.mkdirSync(sauronDir, { recursive: true });
  const requestPath = path.join(sauronDir, REQUEST_FILENAME);
  fs.writeFileSync(
    requestPath,
    JSON.stringify({
      version: 1,
      nonce: requestMeta.nonce,
      tempPath: requestMeta.tempPath,
      expiresAt: requestMeta.expiresAt,
      configuredProviders: requestMeta.configuredProviders,
      createdAt: new Date().toISOString(),
    }, null, 2),
    "utf8",
  );

  return {
    ok: true,
    workspacePath: resolvedPath,
    requestPath,
    configuredProviders: requestMeta.configuredProviders,
    expiresAt: requestMeta.expiresAt,
  };
}

function readCredentialRequest(workspacePath) {
  const requestPath = path.join(getSauronDir(workspacePath), REQUEST_FILENAME);
  if (!fs.existsSync(requestPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(requestPath, "utf8"));
  } catch {
    return null;
  }
}

function readEncryptedPayload(tempPath) {
  if (!tempPath || !fs.existsSync(tempPath)) {
    return null;
  }
  try {
    return decryptPayloadBuffer(fs.readFileSync(tempPath));
  } catch {
    return null;
  }
}

function cleanupCredentialArtifacts(workspacePath, tempPath) {
  const requestPath = path.join(getSauronDir(workspacePath), REQUEST_FILENAME);
  try {
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  } catch {
    // ignore
  }
  try {
    if (fs.existsSync(requestPath)) {
      fs.unlinkSync(requestPath);
    }
  } catch {
    // ignore
  }
}

function getCredentialSyncStatus(settings = {}, workspacePath = "") {
  const payload = mapSettingsToClinePayload(settings);
  const configuredProviders = listConfiguredProviders(payload);
  const request = workspacePath ? readCredentialRequest(workspacePath) : null;
  return {
    configuredProviders,
    hasWorkspace: Boolean(String(workspacePath || "").trim()),
    pendingRequest: Boolean(request),
    pendingExpiresAt: request?.expiresAt || null,
    ready: configuredProviders.length > 0,
  };
}

module.exports = {
  REQUEST_FILENAME,
  mapSettingsToClinePayload,
  writeCredentialRequest,
  readCredentialRequest,
  readEncryptedPayload,
  decryptPayloadBuffer,
  encryptPayloadObject,
  cleanupCredentialArtifacts,
  getCredentialSyncStatus,
  listConfiguredProviders,
  SYNC_KEY_FILE,
};
