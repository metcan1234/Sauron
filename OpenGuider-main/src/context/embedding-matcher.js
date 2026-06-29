const { pipeline, env } = require("@xenova/transformers");
const { debugLog } = require("../utils/debug-logger");

function log(data) {
  debugLog("Embed", data);
}

env.allowLocalModels = false;
env.useBrowserCache = false;

let embeddingPipeline = null;

async function loadEmbeddingModel() {
  if (embeddingPipeline) return embeddingPipeline;
  log("Loading embedding model all-MiniLM-L6-v2...");
  embeddingPipeline = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  log("Embedding model loaded");
  return embeddingPipeline;
}

async function getEmbedding(text) {
  const extractor = await loadEmbeddingModel();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

async function getBatchEmbeddings(texts) {
  const extractor = await loadEmbeddingModel();
  const embeddings = [];
  for (const text of texts) {
    const output = await extractor(text, { pooling: "mean", normalize: true });
    embeddings.push(Array.from(output.data));
  }
  return embeddings;
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function euclideanDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

async function findBestMatch(query, candidates) {
  if (!candidates || candidates.length === 0) return null;
  const queryEmbedding = await getEmbedding(query);
  let bestScore = -Infinity;
  let bestMatch = null;
  for (const candidate of candidates) {
    const candidateEmbedding = candidate.embedding;
    if (candidateEmbedding) {
      const score = cosineSimilarity(queryEmbedding, candidateEmbedding);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { ...candidate, score };
      }
    }
  }
  return bestMatch;
}

async function findTopMatches(query, candidates, topK = 5) {
  if (!candidates || candidates.length === 0) return [];
  const queryEmbedding = await getEmbedding(query);
  const scored = [];
  for (const candidate of candidates) {
    const candidateEmbedding = candidate.embedding;
    if (candidateEmbedding) {
      const score = cosineSimilarity(queryEmbedding, candidateEmbedding);
      scored.push({ ...candidate, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

async function embedElements(elements, labelField = "text") {
  if (!elements || elements.length === 0) return [];
  const labels = elements.map((e) => String(e[labelField] || ""));
  const embeddings = await getBatchEmbeddings(labels);
  return elements.map((element, index) => ({
    ...element,
    embedding: embeddings[index],
  }));
}

module.exports = {
  loadEmbeddingModel,
  getEmbedding,
  getBatchEmbeddings,
  cosineSimilarity,
  euclideanDistance,
  findBestMatch,
  findTopMatches,
  embedElements,
};