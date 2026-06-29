const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { summarizeLogOutput } = require("./local-summarizer");

function getSandboxDir(workspacePath) {
  return path.join(String(workspacePath || "").trim(), ".sauron", "sandbox");
}

function sandboxLargeOutput(workspacePath, label, content, options = {}) {
  const resolved = String(workspacePath || "").trim();
  const raw = String(content || "");
  const threshold = Number(options.thresholdChars) || 1200;
  if (!resolved || raw.length <= threshold) {
    return { summary: raw, sandboxed: false, pointer: null };
  }

  const dir = getSandboxDir(resolved);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = Date.now();
  const hash = crypto.createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 12);
  const safeLabel = String(label || "output").replace(/[^\w.-]+/g, "_").slice(0, 40);
  const fileName = `${safeLabel}-${stamp}-${hash}.txt`;
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, raw, "utf8");

  const relative = `.sauron/sandbox/${fileName}`;
  const summary = summarizeLogOutput(raw, options.maxLines || 8, options.maxSummaryChars || 400);
  return {
    summary: `[Sandbox ${safeLabel}] ${summary}\nFull output: ${relative}`,
    sandboxed: true,
    pointer: relative,
    charCount: raw.length,
  };
}

module.exports = {
  getSandboxDir,
  sandboxLargeOutput,
};
