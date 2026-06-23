const fs = require("fs");

const UTF8_BOM = "\uFEFF";

function escapePowerShellSingleQuoted(value) {
  return String(value || "").replace(/'/g, "''");
}

function escapePowerShellDoubleQuoted(value) {
  return String(value || "")
    .replace(/`/g, "``")
    .replace(/\$/g, "`$")
    .replace(/"/g, '`"');
}

function toPowerShellLiteralPath(value) {
  return `"${escapePowerShellDoubleQuoted(value)}"`;
}

function writeUtf8BomFile(filePath, content) {
  fs.writeFileSync(filePath, UTF8_BOM + content, "utf8");
}

function writeUtf8BomJson(filePath, value) {
  writeUtf8BomFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function encodeUtf8Base64(value) {
  return Buffer.from(String(value || ""), "utf8").toString("base64");
}

function decodeUtf8Base64Lines(variableName, manifestKey) {
  return `$${variableName} = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($manifest.${manifestKey}))`;
}

function encodePowerShellCommand(command) {
  return Buffer.from(String(command || ""), "utf16le").toString("base64");
}

function buildEncodedPowerShellArgs(command) {
  return [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-EncodedCommand",
    encodePowerShellCommand(command),
  ];
}

module.exports = {
  UTF8_BOM,
  escapePowerShellSingleQuoted,
  escapePowerShellDoubleQuoted,
  toPowerShellLiteralPath,
  writeUtf8BomFile,
  writeUtf8BomJson,
  encodeUtf8Base64,
  decodeUtf8Base64Lines,
  encodePowerShellCommand,
  buildEncodedPowerShellArgs,
};
