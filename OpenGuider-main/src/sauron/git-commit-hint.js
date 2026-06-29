const { execFile } = require("child_process");
const path = require("path");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 8000;

function isGitRepo(workspacePath) {
  const gitDir = path.join(String(workspacePath || "").trim(), ".git");
  try {
    const fs = require("fs");
    return fs.existsSync(gitDir);
  } catch {
    return false;
  }
}

function buildSuggestionFromChanges(changedFiles = [], diffStat = "") {
  const names = changedFiles.map((line) => {
    const parts = line.trim().split(/\s+/);
    return parts[parts.length - 1] || "";
  }).filter(Boolean);

  const lower = names.join(" ").toLowerCase();
  const prefixes = [];

  if (/test|spec|__tests__/.test(lower)) {
    prefixes.push("test");
  }
  if (/readme|docs?\/|\.md$/.test(lower)) {
    prefixes.push("docs");
  }
  if (/package\.json|package-lock|pnpm-lock|yarn\.lock/.test(lower)) {
    prefixes.push("chore");
  }
  if (/\.css|\.scss|style/.test(lower) && !/\.(js|ts|tsx|jsx)$/.test(lower)) {
    prefixes.push("style");
  }

  const type = prefixes[0] || "update";
  const scope = inferScope(names);
  const subject = inferSubject(names, diffStat);

  const headline = scope
    ? `${type}(${scope}): ${subject}`
    : `${type}: ${subject}`;

  const bodyLines = [];
  if (diffStat.trim()) {
    bodyLines.push("Değişen dosyalar:");
    bodyLines.push(diffStat.trim().split("\n").slice(0, 12).join("\n"));
  }

  return {
    headline: headline.slice(0, 72),
    body: bodyLines.join("\n").slice(0, 600),
    changedCount: names.length,
  };
}

function inferScope(files) {
  const dirs = new Set();
  for (const file of files) {
    const parts = file.replace(/\\/g, "/").split("/");
    if (parts.length > 1) {
      dirs.add(parts[0]);
    }
  }
  if (dirs.size === 1) {
    return Array.from(dirs)[0].slice(0, 24);
  }
  return "";
}

function inferSubject(files, diffStat) {
  if (files.length === 1) {
    const base = path.basename(files[0], path.extname(files[0]));
    return `adjust ${base}`.slice(0, 48);
  }
  const statLine = diffStat.split("\n").find((line) => line.includes("changed"));
  if (statLine) {
    return statLine.replace(/\s+/g, " ").trim().slice(0, 48);
  }
  return `${files.length} files`.slice(0, 48);
}

async function runGit(workspacePath, args) {
  const cwd = String(workspacePath || "").trim();
  if (!cwd) {
    return { ok: false, stdout: "", stderr: "Workspace path is missing." };
  }
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 512 * 1024,
    });
    return { ok: true, stdout: String(stdout || "") };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error?.stdout || ""),
      stderr: String(error?.stderr || error?.message || ""),
    };
  }
}

async function getGitCommitHint(workspacePath) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "Workspace path is missing." };
  }
  if (!isGitRepo(resolved)) {
    return { ok: false, skipped: true, reason: "not_git_repo" };
  }

  const statusResult = await runGit(resolved, ["status", "--porcelain"]);
  if (!statusResult.ok) {
    return { ok: false, error: statusResult.stderr || "git status failed." };
  }

  const changedLines = statusResult.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!changedLines.length) {
    return { ok: true, hasChanges: false, message: "Çalışma alanı temiz — commit gerekmiyor." };
  }

  const statResult = await runGit(resolved, ["diff", "--stat", "HEAD"]);
  const diffStat = statResult.ok ? statResult.stdout : "";
  const suggestion = buildSuggestionFromChanges(changedLines, diffStat);

  return {
    ok: true,
    hasChanges: true,
    changedCount: suggestion.changedCount,
    suggestion,
    diffStat: diffStat.trim().slice(0, 800),
    copyCommand: `git add -A && git commit -m "${suggestion.headline.replace(/"/g, '\\"')}"`,
  };
}

module.exports = {
  buildSuggestionFromChanges,
  getGitCommitHint,
  isGitRepo,
};
