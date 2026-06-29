const { truncateText } = require("./local-summarizer");

function toBulletLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•]\s*/, ""))
    .slice(0, 12);
}

function compressBriefToBullets(text, maxItems = 8) {
  const bullets = toBulletLines(text).slice(0, maxItems);
  if (!bullets.length) {
    return "";
  }
  return bullets.map((line) => `- ${line}`).join("\n");
}

function compressBriefToParagraph(text, maxChars = 600) {
  const bullets = toBulletLines(text);
  if (!bullets.length) {
    return truncateText(text, maxChars);
  }
  const joined = bullets.join("; ");
  return truncateText(joined, maxChars);
}

function compressHandoffSummary(text, maxChars = 6000) {
  const raw = String(text || "").trim();
  if (!raw || raw.length <= maxChars) {
    return { text: raw, compressed: false, savedChars: 0 };
  }

  const withoutTranscript = raw.replace(/Recent conversation:[\s\S]*$/i, "").trim();
  if (withoutTranscript.length <= maxChars) {
    return {
      text: withoutTranscript,
      compressed: true,
      savedChars: raw.length - withoutTranscript.length,
    };
  }

  const truncated = truncateText(withoutTranscript, maxChars);
  return {
    text: truncated,
    compressed: true,
    savedChars: raw.length - truncated.length,
  };
}

module.exports = {
  compressBriefToBullets,
  compressBriefToParagraph,
  compressHandoffSummary,
  toBulletLines,
};
