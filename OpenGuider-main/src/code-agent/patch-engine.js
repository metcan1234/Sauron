function applySearchReplace(content, search, replace) {
  const source = String(content ?? "");
  const needle = String(search ?? "");
  if (!needle) {
    throw new Error("search string is required.");
  }
  if (!source.includes(needle)) {
    throw new Error("search string not found in file.");
  }
  return source.replace(needle, String(replace ?? ""));
}

function buildUnifiedDiff(filePath, before, after) {
  const oldLines = String(before ?? "").split("\n");
  const newLines = String(after ?? "").split("\n");
  const lines = [`--- a/${filePath}`, `+++ b/${filePath}`, "@@"];
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) {
      if (o !== undefined) {
        lines.push(` ${o}`);
      }
    } else {
      if (o !== undefined) {
        lines.push(`-${o}`);
      }
      if (n !== undefined) {
        lines.push(`+${n}`);
      }
    }
  }
  return lines.join("\n");
}

function countChangedLines(before, after) {
  const oldLines = String(before ?? "").split("\n");
  const newLines = String(after ?? "").split("\n");
  let changed = 0;
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i++) {
    if (oldLines[i] !== newLines[i]) {
      changed++;
    }
  }
  return changed;
}

module.exports = {
  applySearchReplace,
  buildUnifiedDiff,
  countChangedLines,
};
