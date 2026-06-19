const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  mapSettingsToClinePayload,
  writeCredentialRequest,
  readCredentialRequest,
  readEncryptedPayload,
  cleanupCredentialArtifacts,
  listConfiguredProviders,
  encryptPayloadObject,
  decryptPayloadBuffer,
} = require("../../src/sauron/cline-credential-bridge");

test("mapSettingsToClinePayload maps OpenGuider keys to Cline fields", () => {
  const payload = mapSettingsToClinePayload({
    geminiApiKey: "g-key",
    deepseekApiKey: "d-key",
    openaiApiKey: "o-key",
    ollamaUrl: "http://localhost:11434",
  });
  assert.equal(payload.geminiApiKey, "g-key");
  assert.equal(payload.deepSeekApiKey, "d-key");
  assert.equal(payload.openAiApiKey, "o-key");
  assert.equal(payload.ollamaBaseUrl, "http://localhost:11434");
  assert.deepEqual(listConfiguredProviders(payload), ["gemini", "deepseek", "openai", "ollama"]);
});

test("writeCredentialRequest writes meta without secrets in workspace json", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "cline-cred-"));
  const result = writeCredentialRequest(workspace, null, {
    settings: {
      geminiApiKey: "gemini-secret",
      deepseekApiKey: "deepseek-secret",
    },
  });
  assert.equal(result.ok, true);
  const request = readCredentialRequest(workspace);
  assert.ok(request);
  assert.equal(request.version, 1);
  assert.ok(request.tempPath);
  assert.ok(Array.isArray(request.configuredProviders));
  assert.equal(request.configuredProviders.includes("gemini"), true);
  const requestRaw = fs.readFileSync(path.join(workspace, ".sauron", "cline-credential-request.json"), "utf8");
  assert.equal(requestRaw.includes("gemini-secret"), false);
  const payload = readEncryptedPayload(request.tempPath);
  assert.equal(payload.geminiApiKey, "gemini-secret");
  cleanupCredentialArtifacts(workspace, request.tempPath);
});

test("encrypt/decrypt roundtrip", () => {
  const encrypted = encryptPayloadObject({ deepSeekApiKey: "sk-test" });
  const decrypted = decryptPayloadBuffer(encrypted);
  assert.equal(decrypted.deepSeekApiKey, "sk-test");
});
