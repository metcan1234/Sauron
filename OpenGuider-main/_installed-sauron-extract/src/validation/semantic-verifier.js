const { getEmbedding, cosineSimilarity } = require("../context/embedding-matcher");

const DEFAULT_THRESHOLD = 0.6;

function levenshteinDistance(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function stringSimilarity(a, b) {
  if (!a || !b) return 0;
  a = a.toLowerCase().trim();
  b = b.toLowerCase().trim();
  if (a === b) return 1.0;
  if (a.includes(b) || b.includes(a)) return 0.90;
  
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1.0;
  
  return Math.max(0, 1 - distance / maxLength);
}

async function verifyCoordinateWithElements(coordinate, label, elements, options = {}) {
  const { threshold = DEFAULT_THRESHOLD, tolerance = 100 } = options;
  if (!coordinate) {
    return { verified: false, reason: "no coordinate provided", matches: [] };
  }
  if (!label && (!elements || elements.length === 0)) {
    return { verified: false, reason: "no label or elements to verify against", matches: [] };
  }
  const nearbyElements = elements.filter((e) => {
    const rect = e.rect || e.bbox;
    if (!rect) return false;
    const centerX = (rect.x + (rect.x1 || rect.x + rect.width)) / 2;
    const centerY = (rect.y + (rect.y1 || rect.y + rect.height)) / 2;
    const dx = coordinate.x - centerX;
    const dy = coordinate.y - centerY;
    return Math.sqrt(dx * dx + dy * dy) <= tolerance;
  });
  if (nearbyElements.length === 0) {
    return { verified: false, reason: "no elements near coordinate", matches: [] };
  }
  if (!label) {
    return { verified: true, reason: "elements exist near coordinate", matches: nearbyElements };
  }
  const labelEmbedding = await getEmbedding(label);
  const scoredMatches = [];
  for (const element of nearbyElements) {
    const elementName = element.name || element.text || "";
    if (elementName) {
      const textScore = stringSimilarity(label, elementName);
      let embedScore = 0;
      
      try {
        const elementEmbedding = await getEmbedding(elementName);
        embedScore = cosineSimilarity(labelEmbedding, elementEmbedding);
      } catch (e) {
         // ignore embedding error and fallback to textScore
      }
      
      const finalScore = Math.max(textScore, embedScore);
      scoredMatches.push({ element, score: finalScore, textScore, embedScore });
    }
  }
  scoredMatches.sort((a, b) => b.score - a.score);
  const bestMatch = scoredMatches[0];
  if (bestMatch && bestMatch.score >= threshold) {
    return {
      verified: true,
      reason: "label matches element",
      score: bestMatch.score,
      match: bestMatch.element,
      matches: scoredMatches,
    };
  }
  return {
    verified: false,
    reason: bestMatch ? `low similarity (${bestMatch.score.toFixed(2)})` : "no matching elements",
    matches: nearbyElements,
    scores: scoredMatches,
  };
}

async function verifyWithOCR(ocrResult, coordinate, options = {}) {
  const { tolerance = 50, threshold = DEFAULT_THRESHOLD } = options;
  if (!coordinate || !ocrResult) {
    return { verified: false, reason: "missing input" };
  }
  const words = ocrResult.words || [];
  const lines = ocrResult.lines || [];
  const candidates = [...words, ...lines];
  const nearbyCandidates = candidates.filter((w) => {
    const bbox = w.bbox;
    if (!bbox) return false;
    const centerX = (bbox.x0 + bbox.x1) / 2;
    const centerY = (bbox.y0 + bbox.y1) / 2;
    const dx = coordinate.x - centerX;
    const dy = coordinate.y - centerY;
    return Math.sqrt(dx * dx + dy * dy) <= tolerance;
  });
  if (nearbyCandidates.length === 0) {
    return { verified: false, reason: "no text near coordinate" };
  }
  return {
    verified: true,
    reason: "text exists near coordinate",
    matches: nearbyCandidates,
  };
}

function calculateConfidence(options = {}) {
  const { validBounds, hasOCRMatch, hasElementMatch, similarityScore, distanceScore } = options;
  let confidence = 0.5;
  if (validBounds) confidence += 0.2;
  if (hasOCRMatch) confidence += 0.1;
  if (hasElementMatch) confidence += 0.1;
  if (similarityScore !== undefined) confidence += similarityScore * 0.1;
  if (distanceScore !== undefined) confidence += distanceScore * 0.1;
  return Math.min(1, Math.max(0, confidence));
}

module.exports = {
  verifyCoordinateWithElements,
  verifyWithOCR,
  calculateConfidence,
  DEFAULT_THRESHOLD,
};