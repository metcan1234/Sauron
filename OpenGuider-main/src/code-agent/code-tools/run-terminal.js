const { runVerification } = require("../../sauron/build-pipeline/pipeline-state");

const DESTRUCTIVE_PATTERNS = [
  /rm\s+-rf/i,
  /del\s+\/s/i,
  /\bformat\b/i,
  /git\s+push/i,
  /git\s+reset\s+--hard/i,
  /npm\s+publish/i,
  /drop\s+table/i,
];

function isDestructiveCommand(command = "") {
  const cmd = String(command);
  return DESTRUCTIVE_PATTERNS.some((re) => re.test(cmd));
}

async function runTerminalTool(workspacePath, args = {}, options = {}) {
  const command = String(args.command || "").trim();
  if (!command) {
    return { ok: false, error: "command is required." };
  }
  if (isDestructiveCommand(command) && !options.confirmed) {
    return { ok: false, needsConfirm: true, error: "Destructive command requires confirmation." };
  }
  const result = await runVerification(workspacePath, {
    command,
    cwd: args.cwd || workspacePath,
  });
  return {
    ok: result.ok,
    stdout: result.stdout || "",
    stderr: result.stderr || result.error || "",
    skipped: result.skipped,
  };
}

module.exports = { runTerminalTool, isDestructiveCommand, DESTRUCTIVE_PATTERNS };
