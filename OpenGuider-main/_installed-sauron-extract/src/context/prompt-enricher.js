function formatOCRElements(ocrResult) {
  if (!ocrResult || !ocrResult.words || ocrResult.words.length === 0) {
    return "No text detected.";
  }
  const lines = [];
  if (ocrResult.lines && ocrResult.lines.length > 0) {
    for (const line of ocrResult.lines.slice(0, 30)) {
      const { x0, y0, width, height } = line.bbox;
      lines.push(`"${line.text}" at (${x0},${y0}) size ${width}x${height}`);
    }
  } else {
    for (const word of ocrResult.words.slice(0, 50)) {
      const { x0, y0, width, height } = word.bbox;
      lines.push(`"${word.text}" at (${x0},${y0}) size ${width}x${height}`);
    }
  }
  return lines.join("\n");
}

function formatWindowInfo(windowInfo) {
  if (!windowInfo) return "No window information.";
  const parts = [];
  if (windowInfo.focusedWindow) {
    const fw = windowInfo.focusedWindow;
    if (fw.rect) {
      parts.push(`Focused: "${fw.title}" at (${fw.rect.x},${fw.rect.y}) ${fw.rect.width}x${fw.rect.height}`);
    } else {
      parts.push(`Focused: "${fw.title}"`);
    }
  }
  if (windowInfo.windows && windowInfo.windows.length > 0) {
    const visible = windowInfo.windows.slice(0, 10).map((w) => {
      if (w.rect) {
        return `"${w.title}" at (${w.rect.x},${w.rect.y})`;
      }
      return `"${w.title}"`;
    });
    parts.push(`Visible windows:\n${visible.join("\n")}`);
  }
  if (windowInfo.cursorPosition) {
    const cp = windowInfo.cursorPosition;
    parts.push(`Cursor: (${cp.x},${cp.y})`);
  }
  return parts.join("\n");
}

function formatMatchedElements(elements) {
  if (!elements || elements.length === 0) return "No matched elements.";
  const formatted = elements.map((e) => {
    const bbox = e.bbox || {};
    return `"${e.text}" at (${bbox.x0 || bbox.x},${bbox.y0 || bbox.y})`;
  });
  return formatted.join("\n");
}

function buildEnrichedPrompt(context) {
  const sections = [];
  if (context.ocrResult) {
    sections.push(`DETECTED TEXT:\n${formatOCRElements(context.ocrResult)}`);
  }
  if (context.windowInfo) {
    sections.push(`WINDOW CONTEXT:\n${formatWindowInfo(context.windowInfo)}`);
  }
  if (context.matchedElements) {
    sections.push(`RELEVANT ELEMENTS:\n${formatMatchedElements(context.matchedElements)}`);
  }
  if (sections.length === 0) {
    return context.originalPrompt || "";
  }
  return `${context.originalPrompt}\n\n---\nADDITIONAL CONTEXT:\n${sections.join("\n\n")}`;
}

module.exports = {
  formatOCRElements,
  formatWindowInfo,
  formatMatchedElements,
  buildEnrichedPrompt,
};