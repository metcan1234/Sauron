function truncateText(text, maxChars = 500) {
  const value = String(text || "").trim();
  const limit = Math.max(32, Number(maxChars) || 500);
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function summarizeLogOutput(text, maxLines = 8, maxChars = 400) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    return "";
  }
  const head = lines.slice(0, maxLines);
  let body = head.join("\n");
  if (lines.length > maxLines) {
    body += `\n… (+${lines.length - maxLines} more lines)`;
  }
  return truncateText(body, maxChars);
}

function summarizeSymbolList(symbols = [], maxItems = 40) {
  const items = Array.isArray(symbols) ? symbols.slice(0, maxItems) : [];
  if (!items.length) {
    return "";
  }
  return items.map((entry) => {
    if (typeof entry === "string") {
      return entry;
    }
    const name = entry?.name || entry?.symbol || "";
    const kind = entry?.kind ? `${entry.kind} ` : "";
    const file = entry?.file ? ` (${entry.file})` : "";
    return `${kind}${name}${file}`.trim();
  }).filter(Boolean).join("\n");
}

module.exports = {
  truncateText,
  summarizeLogOutput,
  summarizeSymbolList,
};
