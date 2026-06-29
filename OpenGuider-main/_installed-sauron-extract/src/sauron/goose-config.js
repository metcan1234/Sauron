const path = require("path");

const GOOSE_INSTRUCTIONS_VERSION = "1.1";
const GOOSE_INSTRUCTIONS_DIR = ".goose";
const GOOSE_INSTRUCTIONS_FILE = "instructions.md";

const GOOSE_MAX_TURNS = 20;
const GOOSE_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

const GOOSE_TOKEN_MODES = {
  economy: {
    provider: "ollama",
    model: "qwen2.5-coder",
    estimatedCostTl: 0,
  },
  balanced: {
    provider: "openai",
    model: "deepseek-chat",
    fallbackProvider: "openai",
    fallbackModel: "gpt-4o-mini",
    estimatedCostTl: 0.12,
  },
  premium: {
    provider: "openai",
    model: "gpt-4o-mini",
    estimatedCostTl: 0.25,
  },
};

const GOOSE_BINARY_SEARCH_GLOBS = [
  "goose.exe",
  "goose-x86_64-pc-windows-gnu.exe",
  "goose-x86_64-pc-windows-msvc.exe",
];

function getDefaultSearchRoots() {
  const roots = [];
  try {
    roots.push(path.resolve(__dirname, "..", "..", ".."));
  } catch {
    // ignore
  }
  try {
    roots.push(path.resolve(process.cwd(), ".."));
    roots.push(process.cwd());
  } catch {
    // ignore
  }
  return roots;
}

module.exports = {
  GOOSE_INSTRUCTIONS_VERSION,
  GOOSE_INSTRUCTIONS_DIR,
  GOOSE_INSTRUCTIONS_FILE,
  GOOSE_MAX_TURNS,
  GOOSE_IDLE_TIMEOUT_MS,
  GOOSE_TOKEN_MODES,
  GOOSE_BINARY_SEARCH_GLOBS,
  getDefaultSearchRoots,
};
