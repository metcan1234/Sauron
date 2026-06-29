const Tesseract = require("tesseract.js");
const { debugLog, DEBUG } = require("../utils/debug-logger");

function log(data) {
  debugLog("OCR", data);
}

let worker = null;

async function initializeOCR() {
  if (worker) return worker;
  log("Initializing Tesseract worker...");
  let lastLoggedMilestone = -1;
  worker = await Tesseract.createWorker("eng", 1, {
    logger: (m) => {
      if (!DEBUG || !m.status) return;
      const pct = Math.round((m.progress || 0) * 100);
      // Log only status changes and 25% milestones
      if (m.status !== "recognizing text") {
        log(`Status: ${m.status} (${pct}%)`);
        lastLoggedMilestone = -1;
      } else {
        const milestone = Math.floor(pct / 25) * 25;
        if (milestone > lastLoggedMilestone) {
          lastLoggedMilestone = milestone;
          log(`Recognizing: ${pct}%`);
        }
      }
    },
  });
  log("Tesseract worker ready");
  return worker;
}

async function recognizeFromBuffer(imageBuffer) {
  const tesseract = await initializeOCR();
  const result = await tesseract.recognize(imageBuffer);
  return parseOCRResult(result.data);
}

async function recognizeFromPath(imagePath) {
  const tesseract = await initializeOCR();
  const result = await tesseract.recognize(imagePath);
  return parseOCRResult(result.data);
}

function parseOCRResult(data) {
  const words = [];
  if (data.words && Array.isArray(data.words)) {
    for (const word of data.words) {
      if (word.text && word.text.trim().length > 0) {
        const bbox = word.bbox;
        words.push({
          text: word.text.trim(),
          bbox: {
            x0: bbox.x0,
            y0: bbox.y0,
            x1: bbox.x1,
            y1: bbox.y1,
            width: bbox.x1 - bbox.x0,
            height: bbox.y1 - bbox.y0,
          },
          confidence: word.confidence,
        });
      }
    }
  }
  const lines = [];
  if (data.lines && Array.isArray(data.lines)) {
    for (const line of data.lines) {
      if (line.text && line.text.trim().length > 0) {
        const bbox = line.bbox;
        lines.push({
          text: line.text.trim(),
          bbox: {
            x0: bbox.x0,
            y0: bbox.y0,
            x1: bbox.x1,
            y1: bbox.y1,
            width: bbox.x1 - bbox.x0,
            height: bbox.y1 - bbox.y0,
          },
          confidence: line.confidence,
        });
      }
    }
  }
  return {
    text: data.text || "",
    words,
    lines,
    confidence: data.confidence || 0,
  };
}

async function terminate() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}

module.exports = {
  initializeOCR,
  recognizeFromBuffer,
  recognizeFromPath,
  parseOCRResult,
  terminate,
};