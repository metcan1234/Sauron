const { truncateText } = require("./local-summarizer");

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function minifyJsonValue(value) {
  return JSON.stringify(value);
}

function compressLogLines(text, maxLines = 40) {
  const lines = String(text || "").split(/\r?\n/);
  if (lines.length <= maxLines) {
    return text;
  }
  const head = lines.slice(0, Math.floor(maxLines * 0.6));
  const tail = lines.slice(-Math.floor(maxLines * 0.2));
  return [
    ...head,
    `… (${lines.length - head.length - tail.length} lines truncated) …`,
    ...tail,
  ].join("\n");
}

function compressToolOutput(text, options = {}) {
  const raw = String(text || "");
  if (!raw) {
    return { text: "", savedChars: 0, compressed: false };
  }

  const maxChars = Number(options.maxChars) || 1800;
  if (raw.length <= maxChars) {
    return { text: raw, savedChars: 0, compressed: false };
  }

  const trimmed = raw.trim();
  const parsed = tryParseJson(trimmed);
  if (parsed != null) {
    const minified = minifyJsonValue(parsed);
    if (minified.length < raw.length) {
      const capped = truncateText(minified, maxChars);
      return {
        text: capped,
        savedChars: Math.max(0, raw.length - capped.length),
        compressed: true,
        kind: "json-minify",
      };
    }
  }

  if (/^\s*[\[{]|"\w+"\s*:/.test(trimmed)) {
    const collapsed = trimmed.replace(/\s{2,}/g, " ").replace(/\n{2,}/g, "\n");
    if (collapsed.length < raw.length) {
      const capped = truncateText(collapsed, maxChars);
      return {
        text: capped,
        savedChars: Math.max(0, raw.length - capped.length),
        compressed: true,
        kind: "json-collapse",
      };
    }
  }

  const logCompressed = compressLogLines(raw);
  const capped = truncateText(logCompressed, maxChars);
  return {
    text: capped,
    savedChars: Math.max(0, raw.length - capped.length),
    compressed: capped.length < raw.length,
    kind: "log-truncate",
  };
}

module.exports = {
  compressToolOutput,
  compressLogLines,
};
