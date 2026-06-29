const { readCodeIndex } = require("./codebase-indexer");
const { grepWorkspaceTool } = require("./code-tools/grep-workspace");

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
  for (const s of snippets) {
    const block = `### ${s.path}\n${s.text}\n`;
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

module.exports = { retrieveContext };
