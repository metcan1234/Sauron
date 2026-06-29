const { mergeCostOptimizerConfig } = require("./finops/cost-optimizer-config");
const { DEFAULT_GAMEDEV_TASK_MAX_CHARS } = require("./gamedev-config");

function normalizeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function optimizeGamedevTaskText(taskText, options = {}) {
  const maxChars = Number(options.maxChars) || DEFAULT_GAMEDEV_TASK_MAX_CHARS;
  let text = normalizeWhitespace(taskText);
  if (!text) {
    return { text: "", truncated: false };
  }
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }

  const words = text.split(/\s+/).filter(Boolean);
  let result = "";
  for (const word of words) {
    const next = result ? `${result} ${word}` : word;
    if (next.length > maxChars) {
      break;
    }
    result = next;
  }
  if (!result) {
    result = text.slice(0, maxChars).trim();
  }
  return {
    text: result,
    truncated: result.length < text.length,
  };
}

function buildGamedevHandoffSummary({
  taskText,
  engine,
  workspacePath,
  settings = {},
  mcpEntryPath,
  notices = [],
}) {
  const optimizer = mergeCostOptimizerConfig(settings);
  const handoffMaxChars = Number(settings.tokenUltraMaxHandoffChars)
    || optimizer.routing?.handoffMaxChars
    || 4000;
  const optimized = optimizeGamedevTaskText(taskText, {
    maxChars: Math.min(DEFAULT_GAMEDEV_TASK_MAX_CHARS, handoffMaxChars),
  });

  const lines = [
    "[Sauron Game Dev handoff]",
    `Engine: ${String(engine || "unity")}`,
    `Task: ${optimized.text}`,
    "",
    "Use the gamedev-all-in-one MCP server for ALL engine operations (scene, scripts, physics).",
    "MCP tool calls do not consume LLM context — prefer tools over reading project files.",
    "Read .clinerules/sauron-gamedev.md for token discipline.",
    `MCP entry: ${mcpEntryPath}`,
  ];

  if (String(engine || "unity") === "unreal") {
    lines.push("For complex editor ops prefer unreal_run_python via MCP; store scripts under .sauron/cache/unreal-script.py");
  }

  if (workspacePath) {
    lines.push(`Workspace: ${workspacePath}`);
  }

  if (notices.length > 0) {
    lines.push("", ...notices.map((n) => `- ${n}`));
  }

  let summary = lines.join("\n").trim();
  if (summary.length > handoffMaxChars) {
    summary = `${summary.slice(0, Math.max(0, handoffMaxChars - 1)).trimEnd()}…`;
  }

  return {
    summary,
    optimizedTask: optimized.text,
    truncated: optimized.truncated,
    handoffMaxChars,
    tokenPolicy: {
      mcpTools: "full",
      llmTier: optimizer.coreModelTier || "economy",
      includeTranscript: false,
      handoffMaxChars,
      clarifySkipped: settings.finopsClarifySkipEnabled !== false,
    },
  };
}

module.exports = {
  normalizeWhitespace,
  optimizeGamedevTaskText,
  buildGamedevHandoffSummary,
};
