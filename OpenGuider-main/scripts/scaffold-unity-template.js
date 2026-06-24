#!/usr/bin/env node
const { scaffoldUnityTemplate } = require("../src/sauron/scaffold-unity-template");

function main() {
  const workspacePath = process.argv[2];
  const templateId = process.argv[3] || "co-op-climb";
  if (!workspacePath) {
    console.error("Usage: node scripts/scaffold-unity-template.js <workspacePath> [templateId]");
    process.exit(1);
  }
  const result = scaffoldUnityTemplate(workspacePath, templateId);
  if (!result.ok) {
    console.error(result.error || "Scaffold failed.");
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
}

main();
