import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { executeUnityCommand } from "../connectors/unity/index.js";
import { recordGamedevMcpTool } from "../finops/gamedev-ledger.js";

function toolResult(result: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    structuredContent: result
  };
}

function wrapUnityTool(toolName: string, method: string, params: Record<string, unknown>, timeoutMs?: number) {
  return executeUnityCommand(method, params, { timeoutMs }).then((result) => {
    if (result.ok) {
      recordGamedevMcpTool(toolName);
    }
    return result;
  });
}

export function registerUnityScriptTools(server: McpServer) {
  server.registerTool(
    "unity_set_script_source",
    {
      title: "Unity Set Script Source",
      description: "Replace the entire source of a C# script under Assets/.",
      inputSchema: {
        scriptPath: z.string().min(1).describe("Relative path from Assets/ (e.g. 'SauronGameDev/co-op-climb/ClimbController.cs')."),
        source: z.string().describe("New C# source code."),
        timeoutMs: z.number().int().min(0).max(30_000).default(5_000).describe("Command timeout.")
      }
    },
    async ({ scriptPath, source, timeoutMs }) => {
      const result = await wrapUnityTool("unity_set_script_source", "set_script_source", { scriptPath, source }, timeoutMs);
      return toolResult(result);
    }
  );

  server.registerTool(
    "unity_edit_script_lines",
    {
      title: "Unity Edit Script Lines",
      description: "Replace a substring in a C# script source using old_string/new_string matching.",
      inputSchema: {
        scriptPath: z.string().min(1).describe("Relative path from Assets/."),
        oldString: z.string().min(1).describe("Exact text to find."),
        newString: z.string().describe("Replacement text."),
        timeoutMs: z.number().int().min(0).max(30_000).default(5_000).describe("Command timeout.")
      }
    },
    async ({ scriptPath, oldString, newString, timeoutMs }) => {
      const result = await wrapUnityTool(
        "unity_edit_script_lines",
        "edit_script_lines",
        { scriptPath, oldString, newString },
        timeoutMs
      );
      return toolResult(result);
    }
  );

  server.registerTool(
    "unity_grep_scripts",
    {
      title: "Unity Grep Scripts",
      description: "Search C# scripts under Assets/ for a pattern.",
      inputSchema: {
        pattern: z.string().min(1).describe("Search pattern (plain text or regex)."),
        rootPath: z.string().default("Assets").describe("Root folder under project."),
        caseSensitive: z.boolean().default(true).describe("Case-sensitive search."),
        timeoutMs: z.number().int().min(0).max(30_000).default(10_000).describe("Command timeout.")
      }
    },
    async ({ pattern, rootPath, caseSensitive, timeoutMs }) => {
      const result = await wrapUnityTool(
        "unity_grep_scripts",
        "grep_scripts",
        { pattern, rootPath, caseSensitive },
        timeoutMs
      );
      return toolResult(result);
    }
  );
}
