const { desktopCapturer, screen } = require("electron");

let lastCapture = {
  capturedAt: 0,
  images: [],
};
let inFlightCapture = null;

const SAURON_WINDOW_TITLE_MARKERS = ["sauron", "openguider", "electron"];

function mapSourceToDisplay(source, displays) {
  const displayId = Number(source.display_id || 0);
  if (displayId) {
    const match = displays.find((display) => Number(display.id) === displayId);
    if (match) {
      return match;
    }
  }
  return null;
}

function isSauronWindowSource(source) {
  const name = String(source?.name || "").toLowerCase();
  return SAURON_WINDOW_TITLE_MARKERS.some((marker) => name.includes(marker));
}

function encodeThumbnail(source, { jpegQuality = 85, maxWidth = null, maxHeight = null } = {}) {
  const size = source.thumbnail.getSize();
  let image = source.thumbnail;
  if (maxWidth || maxHeight) {
    const targetW = maxWidth || size.width;
    const targetH = maxHeight || size.height;
    const scale = Math.min(1, targetW / size.width, targetH / size.height);
    if (scale < 1) {
      image = image.resize({
        width: Math.max(1, Math.round(size.width * scale)),
        height: Math.max(1, Math.round(size.height * scale)),
      });
    }
  }
  const jpeg = image.toJPEG(Math.min(100, Math.max(40, jpegQuality)));
  const finalSize = image.getSize();
  return {
    base64Jpeg: jpeg.toString("base64"),
    width: finalSize.width,
    height: finalSize.height,
  };
}

async function captureFocusedWindow({ jpegQuality = 72, maxWidth = 1280, maxHeight = 900 } = {}) {
  const sources = await desktopCapturer.getSources({
    types: ["window"],
    thumbnailSize: { width: maxWidth, height: maxHeight },
    fetchWindowIcons: false,
  });

  const candidates = sources
    .filter((source) => !isSauronWindowSource(source))
    .map((source) => {
      const size = source.thumbnail.getSize();
      return { source, area: size.width * size.height };
    })
    .filter((item) => item.area > 10_000)
    .sort((a, b) => b.area - a.area);

  if (candidates.length === 0) {
    return null;
  }

  const { source } = candidates[0];
  const encoded = encodeThumbnail(source, { jpegQuality, maxWidth, maxHeight });
  return [{
    label: `Active window: ${String(source.name || "Window").slice(0, 48)}`,
    screenNumber: 1,
    displayId: "window",
    isPrimary: true,
    captureMode: "active-window",
    ...encoded,
  }];
}

async function rawCaptureAllScreens({
  jpegQuality = 85,
  maxWidth = null,
  maxHeight = null,
  primaryOnly = false,
} = {}) {
  const startedAt = Date.now();
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const targetDisplays = primaryOnly
    ? [primary]
    : displays;
  const maxW = Math.max(...targetDisplays.map((d) => d.size.width));
  const maxH = Math.max(...targetDisplays.map((d) => d.size.height));
  const thumbW = maxWidth ? Math.min(maxW, maxWidth) : maxW;
  const thumbH = maxHeight ? Math.min(maxH, maxHeight) : maxH;

  const getSourcesStartedAt = Date.now();
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: thumbW, height: thumbH },
  });
  const getSourcesDurationMs = Date.now() - getSourcesStartedAt;

  let encodeDurationMs = 0;
  const images = [];
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    const matchedDisplay = mapSourceToDisplay(source, displays);
    const display = matchedDisplay || displays[index] || displays[0];
    if (primaryOnly && display.id !== primary.id) {
      continue;
    }
    const isPrimary = display.id === primary.id;
    const encodeStart = Date.now();
    const encoded = encodeThumbnail(source, { jpegQuality, maxWidth, maxHeight });
    encodeDurationMs += Date.now() - encodeStart;

    images.push({
      label: isPrimary ? `Screen ${images.length + 1} (primary)` : `Screen ${images.length + 1}`,
      screenNumber: images.length + 1,
      displayId: String(display.id),
      isPrimary,
      captureMode: primaryOnly ? "primary-screen" : "all-screens",
      ...encoded,
    });
  }

  return {
    images,
    timings: {
      totalDurationMs: Date.now() - startedAt,
      getSourcesDurationMs,
      encodeDurationMs,
      sourceCount: sources.length,
      displayCount: displays.length,
      maxWidth: thumbW,
      maxHeight: thumbH,
      fromCache: false,
    },
  };
}

async function captureAllScreens({
  forceFresh = false,
  maxAgeMs = 900,
  includeTimings = false,
  mode = "default",
  jpegQuality = null,
  maxWidth = null,
  maxHeight = null,
  preferActiveWindow = false,
  primaryOnly = false,
} = {}) {
  const isMicroGuide = mode === "micro-guide";
  const effectiveQuality = jpegQuality ?? (isMicroGuide ? 72 : 85);
  const effectiveMaxW = maxWidth ?? (isMicroGuide ? 1280 : null);
  const effectiveMaxH = maxHeight ?? (isMicroGuide ? 900 : null);
  const usePrimaryOnly = primaryOnly || isMicroGuide;

  if (isMicroGuide && preferActiveWindow !== false) {
    try {
      const windowImages = await captureFocusedWindow({
        jpegQuality: effectiveQuality,
        maxWidth: effectiveMaxW,
        maxHeight: effectiveMaxH,
      });
      if (windowImages?.length) {
        const result = {
          images: windowImages,
          timings: {
            totalDurationMs: 0,
            getSourcesDurationMs: 0,
            encodeDurationMs: 0,
            sourceCount: 1,
            displayCount: 1,
            fromCache: false,
            captureMode: "active-window",
          },
        };
        lastCapture = { capturedAt: Date.now(), images: result.images };
        return includeTimings ? result : result.images;
      }
    } catch {
      // fall through to screen capture
    }
  }

  const now = Date.now();
  const cacheKey = `${mode}:${effectiveQuality}:${effectiveMaxW}`;
  if (!forceFresh && lastCapture.images.length > 0 && now - lastCapture.capturedAt <= maxAgeMs) {
    if (includeTimings) {
      return {
        images: lastCapture.images,
        timings: {
          totalDurationMs: 0,
          getSourcesDurationMs: 0,
          encodeDurationMs: 0,
          sourceCount: lastCapture.images.length,
          displayCount: lastCapture.images.length,
          fromCache: true,
        },
      };
    }
    return lastCapture.images;
  }

  if (inFlightCapture) {
    const inFlightResult = await inFlightCapture;
    return includeTimings ? inFlightResult : inFlightResult.images;
  }

  inFlightCapture = rawCaptureAllScreens({
    jpegQuality: effectiveQuality,
    maxWidth: effectiveMaxW,
    maxHeight: effectiveMaxH,
    primaryOnly: usePrimaryOnly,
  })
    .then((result) => {
      lastCapture = {
        capturedAt: Date.now(),
        images: result.images,
        cacheKey,
      };
      return result;
    })
    .finally(() => {
      inFlightCapture = null;
    });

  const result = await inFlightCapture;
  return includeTimings ? result : result.images;
}

module.exports = {
  captureAllScreens,
  captureFocusedWindow,
};
