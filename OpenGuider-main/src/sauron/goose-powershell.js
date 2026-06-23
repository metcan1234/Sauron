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
  encodePowerShellCommand,
  buildEncodedPowerShellArgs,
};
