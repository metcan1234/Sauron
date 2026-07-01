const { readCodeIndex } = require("./codebase-indexer");
const { grepWorkspaceTool } = require("./code-tools/grep-workspace");
const { extractAtMentions, readMentionFile } = require("../panel/at-file-context");
const { buildSemanticContext } = require("./semantic-retriever");

function scoreEntry(entry, tokens) {
  const text = `${entry.path} ${entry.text}`.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (text.includes(token)) {
      score += token.length > 3 ? 2 : 1;
    }
  }
  return score;
}

function retrieveContext(workspacePath, goal, settings = {}) {
  const maxChars = Number(settings.finopsCodeContextMaxChars) || 4000;
  const maxSnippets = 8;
  const perSnippet = 600;

  const tokens = String(goal || "")
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/i)
    .filter((t) => t.length > 2)
    .slice(0, 20);

  const index = readCodeIndex(workspacePath);
  const snippets = [];

  for (const mention of extractAtMentions(goal)) {
    const file = readMentionFile(workspacePath, mention);
    if (file.ok) {
      snippets.unshift({
        path: file.path,
        text: file.content.slice(0, perSnippet),
        source: "at-mention",
      });
    }
  }

  if (index?.entries?.length) {
    const scored = index.entries
      .map((entry) => ({ entry, score: scoreEntry(entry, tokens) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSnippets);

    for (const { entry } of scored) {
      snippets.push({
        path: entry.path,
        text: entry.text.slice(0, perSnippet),
        source: "index",
      });
    }
  }

  if (snippets.length < 3 && tokens.length > 0) {
    const pattern = tokens.slice(0, 3).join("|");
    const grep = grepWorkspaceTool(workspacePath, { pattern });
    if (grep.ok && grep.matches) {
      for (const m of grep.matches.slice(0, 5)) {
        snippets.push({
          path: m.path,
          text: `L${m.line}: ${m.text}`,
          source: "grep",
        });
      }
    }
  }

  let total = 0;
  const lines = [];
  const seenPaths = new Set();
  for (const s of snippets) {
    const key = String(s.path || "").toLowerCase();
    if (seenPaths.has(key)) {
      continue;
    }
    seenPaths.add(key);
    const block = `### ${s.path} (${s.source})\n${s.text}\n`;
    if (total + block.length > maxChars) {
      break;
    }
    lines.push(block);
    total += block.length;
  }

  return {
    contextText: lines.join("\n"),
    snippetCount: lines.length,
  };
}

async function retrieveContextAsync(workspacePath, goal, settings = {}) {
  if (settings.codeSemanticSearchEnabled !== false) {
    try {
      const semantic = await buildSemanticContext(workspacePath, goal, settings);
      if (semantic.snippetCount > 0) {
        return semantic;
      }
    } catch {
      // fall back to keyword retrieval
    }
  }
  return retrieveContext(workspacePath, goal, settings);
}

module.exports = { retrieveContext, retrieveContextAsync };
