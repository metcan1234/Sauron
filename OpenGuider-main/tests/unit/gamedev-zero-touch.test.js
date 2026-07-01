const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  enablePluginInUproject,
  findUprojectFile,
  isFunplayPluginInstalled,
  findPluginRoot,
} = require("../../src/sauron/gamedev-unreal-installer");
const {
  findUnityEditorExecutable,
  findUnrealEditorExecutable,
} = require("../../src/sauron/gamedev-editor-launcher");
const { ensureUnityMcpPackage } = require("../../src/sauron/gamedev-project-bootstrap");

test("enablePluginInUproject enables FunplayMCP", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-ue-plugin-"));
  const uprojectPath = path.join(tmp, "Game.uproject");
  fs.writeFileSync(uprojectPath, JSON.stringify({ FileVersion: 3 }), "utf8");

  const result = enablePluginInUproject(uprojectPath, "FunplayMCP");
  assert.equal(result.ok, true);

  const project = JSON.parse(fs.readFileSync(uprojectPath, "utf8"));
  assert.ok(Array.isArray(project.Plugins));
  assert.equal(project.Plugins.some((entry) => entry.Name === "FunplayMCP" && entry.Enabled === true), true);
});

test("findUprojectFile detects unreal project root", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-ue-find-"));
  fs.writeFileSync(path.join(tmp, "Demo.uproject"), "{}", "utf8");
  assert.equal(path.basename(findUprojectFile(tmp)), "Demo.uproject");
});

test("isFunplayPluginInstalled checks uplugin marker", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-funplay-"));
  const pluginRoot = path.join(tmp, "Plugins", "FunplayMCP");
  fs.mkdirSync(pluginRoot, { recursive: true });
  fs.writeFileSync(path.join(pluginRoot, "FunplayMCP.uplugin"), "{}", "utf8");
  assert.equal(isFunplayPluginInstalled(tmp), true);
});

test("findPluginRoot locates nested FunplayMCP folder", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-funplay-root-"));
  const nested = path.join(tmp, "extract", "FunplayMCP");
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(nested, "FunplayMCP.uplugin"), "{}", "utf8");
  assert.equal(findPluginRoot(tmp).endsWith("FunplayMCP"), true);
});

test("ensureUnityMcpPackage adds coplay dependency once", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-unity-pkg-"));
  fs.mkdirSync(path.join(tmp, "Assets"));
  const first = ensureUnityMcpPackage(tmp);
  assert.equal(first.ok, true);
  assert.equal(first.reason, "package-added");

  const second = ensureUnityMcpPackage(tmp);
  assert.equal(second.reason, "already-installed");
});

test("editor path helpers return string or null without throwing", () => {
  assert.ok(findUnityEditorExecutable() === null || typeof findUnityEditorExecutable() === "string");
  assert.ok(findUnrealEditorExecutable() === null || typeof findUnrealEditorExecutable() === "string");
});
