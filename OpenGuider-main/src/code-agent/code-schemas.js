const { z } = require("zod");

const CodeAgentPlanSchema = z.object({
  summary: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1).max(8),
  complexityHint: z.enum(["low", "medium", "high"]).default("low"),
});

const CodeAgentActSchema = z.object({
  action: z.enum(["tool", "finish"]),
  tool: z.enum([
    "read_file",
    "write_file",
    "search_replace",
    "list_directory",
    "grep_workspace",
    "run_terminal",
    "git_status",
    "git_diff",
  ]).optional(),
  args: z.record(z.string(), z.unknown()).default({}),
  message: z.string().default(""),
  finishSummary: z.string().optional(),
});

module.exports = {
  CodeAgentPlanSchema,
  CodeAgentActSchema,
};
