function buildFilePointer(filePath, lineStart = null, lineEnd = null) {
  const pathValue = String(filePath || "").trim();
  if (!pathValue) {
    return null;
  }
  const pointer = { type: "file", path: pathValue };
  if (lineStart != null && lineEnd != null) {
    pointer.lineRange = [Number(lineStart), Number(lineEnd)];
  }
  return pointer;
}

function buildCachePointer(relativePath, hash = "") {
  const pathValue = String(relativePath || "").trim();
  if (!pathValue) {
    return null;
  }
  return {
    type: "cache",
    path: pathValue,
    ...(hash ? { hash: String(hash) } : {}),
  };
}

function formatPointerLine(pointer) {
  if (!pointer || !pointer.path) {
    return "";
  }
  if (pointer.type === "file" && Array.isArray(pointer.lineRange)) {
    return `@file:${pointer.path}#L${pointer.lineRange[0]}-${pointer.lineRange[1]}`;
  }
  if (pointer.hash) {
    return `@cache:${pointer.path}#${pointer.hash.slice(0, 8)}`;
  }
  return `@cache:${pointer.path}`;
}

module.exports = {
  buildFilePointer,
  buildCachePointer,
  formatPointerLine,
};
