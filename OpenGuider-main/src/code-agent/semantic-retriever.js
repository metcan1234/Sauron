const { readCodeIndex } = require("./codebase-indexer");
const { getEmbedding, getBatchEmbeddings, cosineSimilarity } = require("../context/embedding-matcher");

const MAX_CANDIDATES = 30;
const MAX_RESULTS = 8;

function keywordPrefilter(entries, goal, limit = MAX_CANDIDATES) {
  const tokens = String(goal || "")
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/i)
    .filter((t) => t.length > 2);

  if (tokens.length === 0) {
    return entries.slice(0, limit);
  }

  return entries
    .map((entry) => {
      const text = `${entry.path} ${entry.text}`.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (text.includes(token)) {
          score += token.length > 3 ? 2 : 1;
        }
      }
      return { entry, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.entry);
}

async function rankEntriesByEmbedding(goal, entries) {
  if (!entries.length) {
    return [];
  }
  const queryEmbedding = await getEmbedding(String(goal || "").slice(0, 512));
  const texts = entries.map((entry) => String(entry.text || "").slice(0, 512));
  const embeddings = await getBatchEmbeddings(texts);
  return entries
    .map((entry, index) => ({
      entry,
      score: cosineSimilarity(queryEmbedding, embeddings[index]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);
}

async function buildSemanticContext(workspacePath, goal, settings = {}) {
  const index = readCodeIndex(workspacePath);
  if (!index?.entries?.length) {
    return { contextText: "", snippetCount: 0, mode: "empty" };
  }

  const candidates = keywordPrefilter(index.entries, goal);
  const pool = candidates.length > 0 ? candidates : index.entries.slice(0, MAX_CANDIDATES);
  const ranked = await rankEntriesByEmbedding(goal, pool);
  const maxChars = Number(settings.finopsCodeContextMaxChars) || 4000;
  const lines = [];
  let total = 0;

  for (const { entry, score } of ranked) {
    const block = `### ${entry.path} (semantic:${score.toFixed(2)})\n${String(entry.text || "").slice(0, 600)}\n`;
    if (total + block.length > maxChars) {
      break;
    }
    lines.push(block);
    total += block.length;
  }

  return {
    contextText: lines.join("\n"),
    snippetCount: lines.length,
    mode: "semantic",
  };
}

module.exports = {
  keywordPrefilter,
  buildSemanticContext,
};
