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

function getBundledGoosePaths() {
  const paths = [];
  try {
    const openGuiderRoot = path.resolve(__dirname, "..", "..", "..");
    paths.push(path.join(openGuiderRoot, "goose", "goose.exe"));
    paths.push(path.join(openGuiderRoot, "goose", "goosed.exe"));
    paths.push(path.join(openGuiderRoot, "..", "goose", "goose.exe"));
    paths.push(path.join(openGuiderRoot, "..", "goose", "goosed.exe"));
    paths.push(path.join(openGuiderRoot, "..", "goose-package", "goose.exe"));
    paths.push(path.join(openGuiderRoot, "..", "..", "goose", "goose.exe"));
  } catch {
    // ignore
  }
  return paths;
}

function getDefaultSearchRoots() {
  const roots = [];
  const seen = new Set();
  const addRoot = (candidate) => {
    const resolved = String(candidate || "").trim();
    if (!resolved) {
      return;
    }
    const key = resolved.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    roots.push(resolved);
  };

  try {
    addRoot(path.resolve(__dirname, "..", "..", ".."));
    addRoot(path.join(path.resolve(__dirname, "..", "..", ".."), "goose"));
    addRoot(path.join(path.resolve(__dirname, "..", "..", ".."), "..", "goose-package"));
    addRoot(path.resolve(__dirname, "..", "..", "..", ".."));
    addRoot(path.join(path.resolve(__dirname, "..", "..", "..", ".."), "goose"));
  } catch {
    // ignore
  }
  try {
    addRoot(path.resolve(process.cwd(), ".."));
    addRoot(process.cwd());
    addRoot(path.join(process.cwd(), "goose"));
    addRoot(path.join(process.cwd(), "..", "goose"));
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
  getBundledGoosePaths,
  getDefaultSearchRoots,
};
