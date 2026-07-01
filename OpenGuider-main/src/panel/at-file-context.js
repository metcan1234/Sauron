const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { resolveSafePath } = require("../code-agent/workspace-sandbox");

const AT_MENTION_PATTERN = /@([^\s@]+)/g;
const MAX_FILES = 6;
const MAX_CHARS_PER_FILE = 8000;
const MAX_TOTAL_CHARS = 24000;
const SMART_TRIM_HEAD_LINES = 120;
const SMART_TRIM_TAIL_LINES = 120;

function smartTrimFileContent(content = "", enabled = true) {
  const text = String(content || "");
  const lines = text.split(/\r?\n/);
  const omitted = lines.length - SMART_TRIM_HEAD_LINES - SMART_TRIM_TAIL_LINES;
  if (enabled && omitted > 0) {
    const head = lines.slice(0, SMART_TRIM_HEAD_LINES).join("\n");
    const tail = lines.slice(-SMART_TRIM_TAIL_LINES).join("\n");
    const body = `${head}\n…[${omitted} satır özetlendi]…\n${tail}`;
    return {
      content: body.slice(0, MAX_CHARS_PER_FILE),
      truncated: body.length > MAX_CHARS_PER_FILE,
      smartTrimmed: true,
    };
  }
  return { content: text.slice(0, MAX_CHARS_PER_FILE), truncated: text.length > MAX_CHARS_PER_FILE };
}

function extractAtMentions(text = "") {
  const mentions = [];
  const seen = new Set();
  let match;
  const source = String(text || "");
  AT_MENTION_PATTERN.lastIndex = 0;
  while ((match = AT_MENTION_PATTERN.exec(source)) !== null) {
    const raw = String(match[1] || "").trim().replace(/^['"]|['"]$/g, "");
    if (!raw || seen.has(raw.toLowerCase())) {
      continue;
    }
    seen.add(raw.toLowerCase());
    mentions.push(raw);
    if (mentions.length >= MAX_FILES) {
      break;
    }
  }
  return mentions;
}

function resolveMentionPath(workspacePath, mention) {
  const workspace = String(workspacePath || "").trim();
  if (!workspace || !mention) {
    return null;
  }
  const normalized = mention.replace(/\\/g, "/").replace(/^\/+/, "");
  try {
    return resolveSafePath(workspace, normalized);
  } catch {
    return null;
  }
}

function readMentionFile(workspacePath, mention, options = {}) {
  const fullPath = resolveMentionPath(workspacePath, mention);
  if (!fullPath || !fs.existsSync(fullPath)) {
    return { ok: false, mention, error: "not_found" };
  }
  const stat = fs.statSync(fullPath);
  if (!stat.isFile()) {
    return { ok: false, mention, error: "not_a_file" };
  }
  if (stat.size > 512 * 1024) {
    return { ok: false, mention, error: "file_too_large" };
  }
  const rawContent = fs.readFileSync(fullPath, "utf8");
  const smartTrim = options.smartTrim !== false;
  const trimmed = smartTrimFileContent(rawContent, smartTrim);
  return {
    ok: true,
    mention,
    path: mention.replace(/\\/g, "/"),
    content: trimmed.content,
    truncated: trimmed.truncated,
    smartTrimmed: trimmed.smartTrimmed === true,
  };
}

function readFolderContext(workspacePath, mention) {
  const workspace = String(workspacePath || "").trim();
  if (!workspace) {
    return { ok: false, error: "no_workspace" };
  }
  const folderPrefix = mention.startsWith("folder:") ? mention.slice(7) : "";
  const entries = [];
  try {
    if (!folderPrefix) {
      for (const name of fs.readdirSync(workspace)) {
        const full = path.join(workspace, name);
        const stat = fs.statSync(full);
        entries.push(`${name}${stat.isDirectory() ? "/" : ""}`);
      }
    } else {
      const dir = resolveMentionPath(workspace, folderPrefix);
      if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        return { ok: false, error: "not_a_folder" };
      }
      for (const name of fs.readdirSync(dir)) {
        entries.push(`${folderPrefix}/${name}`);
      }
    }
  } catch (error) {
    return { ok: false, error: error.message || "read_failed" };
  }
  return {
    ok: true,
    content: entries.slice(0, 80).join("\n"),
    path: folderPrefix || ".",
  };
}

function readGitDiffContext(workspacePath) {
  const workspace = String(workspacePath || "").trim();
  if (!workspace) {
    return { ok: false, error: "no_workspace" };
  }
  try {
    const output = execFileSync("git", ["diff", "--stat", "HEAD"], {
      cwd: workspace,
      encoding: "utf8",
      maxBuffer: 512 * 1024,
    });
    const diffBody = execFileSync("git", ["diff", "HEAD"], {
      cwd: workspace,
      encoding: "utf8",
      maxBuffer: 512 * 1024,
    });
    const content = `${String(output || "").trim()}\n\n${String(diffBody || "").trim()}`.trim();
    return {
      ok: true,
      content: content.slice(0, MAX_CHARS_PER_FILE),
      path: "git-diff",
    };
  } catch (error) {
    return { ok: false, error: error.message || "git_diff_failed" };
  }
}

function resolveMentionContext(workspacePath, mention) {
  if (mention === "git-diff") {
    return readGitDiffContext(workspacePath);
  }
  if (mention === "folder" || mention.startsWith("folder:")) {
    return readFolderContext(workspacePath, mention);
  }
  return readMentionFile(workspacePath, mention);
}

function buildAtFileContextBlock(workspacePath, text = "", options = {}) {
  const mentions = extractAtMentions(text);
  if (mentions.length === 0) {
    return { block: "", files: [], mentions: [] };
  }

  const files = [];
  const blocks = [];
  let total = 0;
  const fileOptions = { smartTrim: options.smartTrim !== false };

  for (const mention of mentions) {
    let result = mention === "git-diff" || mention.startsWith("folder")
      ? resolveMentionContext(workspacePath, mention)
      : readMentionFile(workspacePath, mention, fileOptions);
    if (!result?.ok && mention !== "git-diff" && !mention.startsWith("folder")) {
      result = resolveMentionContext(workspacePath, mention);
    }
    if (!result?.ok) {
      blocks.push(`### @${mention}\n(bağlam okunamadı: ${result?.error || "unknown"})\n`);
      continue;
    }
    const body = `\`\`\`\n${result.content}\n\`\`\``;
    const suffix = result.truncated ? " (kısaltıldı)" : "";
    const block = `### @${result.path || mention}${suffix}\n${body}\n`;
    if (total + block.length > MAX_TOTAL_CHARS) {
      break;
    }
    blocks.push(block);
    total += block.length;
    files.push({ path: result.path || mention, chars: String(result.content || "").length });
  }

  if (blocks.length === 0) {
    return { block: "", files: [], mentions };
  }

  return {
    block: [
      "# @ DOSYA BAĞLAMI (kullanıcı mesajında referans verildi)",
      ...blocks,
    ].join("\n"),
    files,
    mentions,
  };
}

function enrichTextWithAtFileContext(text, workspacePath, enabled = true, options = {}) {
  if (!enabled) {
    return { text: String(text || ""), context: null };
  }
  const workspace = String(workspacePath || "").trim();
  if (!workspace) {
    return { text: String(text || ""), context: null };
  }
  const { isSmartAtFileTrimEnabled } = require("../sauron/token-ultra/token-ultra-v3-config");
  const smartTrim = options.smartTrim !== undefined
    ? options.smartTrim
    : isSmartAtFileTrimEnabled(options.settings || {});
  const { block, files, mentions } = buildAtFileContextBlock(workspace, text, { smartTrim });
  if (!block) {
    return { text: String(text || ""), context: null };
  }
  const enriched = `${String(text || "").trim()}\n\n---\n${block}`;
  return {
    text: enriched,
    context: { files, mentions, blockLength: block.length },
  };
}

module.exports = {
  AT_MENTION_PATTERN,
  extractAtMentions,
  smartTrimFileContent,
  buildAtFileContextBlock,
  enrichTextWithAtFileContext,
  readMentionFile,
  readFolderContext,
  readGitDiffContext,
};
