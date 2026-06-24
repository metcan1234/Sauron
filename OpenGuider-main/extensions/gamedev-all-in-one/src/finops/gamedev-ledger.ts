import fs from "node:fs";
import path from "node:path";

const LEDGER_FILENAME = "gamedev-finops.jsonl";

function resolveWorkspacePath(): string {
  return String(
    process.env.SAURON_GAMEDEV_WORKSPACE
      || process.env.UNITY_PROJECT_PATH
      || process.env.ROBLOX_PROJECT_PATH
      || ""
  ).trim();
}

export function recordGamedevMcpTool(tool: string) {
  const workspacePath = resolveWorkspacePath();
  if (!workspacePath) {
    return false;
  }
  const ledgerPath = path.join(workspacePath, ".sauron", LEDGER_FILENAME);
  try {
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      type: "mcp-tool",
      tool,
      count: 1,
      source: "gamedev-all-in-one",
    });
    fs.appendFileSync(ledgerPath, `${line}\n`, "utf8");
    return true;
  } catch {
    return false;
  }
}

export function recordGamedevLlmUsage(tokens: number, operation = "game-dev-plan") {
  const workspacePath = resolveWorkspacePath();
  if (!workspacePath || !tokens) {
    return false;
  }
  const ledgerPath = path.join(workspacePath, ".sauron", LEDGER_FILENAME);
  try {
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      type: "llm-usage",
      operation,
      tokens,
      source: "gamedev-all-in-one",
    });
    fs.appendFileSync(ledgerPath, `${line}\n`, "utf8");
    return true;
  } catch {
    return false;
  }
}
