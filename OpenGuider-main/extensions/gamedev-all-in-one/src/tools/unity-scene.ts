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

export function registerUnitySceneTools(server: McpServer) {
  server.registerTool(
    "unity_save_scene",
    {
      title: "Unity Save Scene",
      description: "Save the active Unity scene.",
      inputSchema: {
        scenePath: z.string().default("").describe("Optional scene path. Empty saves active scene."),
        timeoutMs: z.number().int().min(0).max(30_000).default(5_000).describe("Command timeout.")
      }
    },
    async ({ scenePath, timeoutMs }) => {
      const result = await wrapUnityTool("unity_save_scene", "save_scene", { scenePath }, timeoutMs);
      return toolResult(result);
    }
  );

  server.registerTool(
    "unity_load_scene",
    {
      title: "Unity Load Scene",
      description: "Load a Unity scene by path under Assets/.",
      inputSchema: {
        scenePath: z.string().min(1).describe("Scene path (e.g. 'SauronGameDev/co-op-climb/Scenes/Main.unity')."),
        timeoutMs: z.number().int().min(0).max(30_000).default(5_000).describe("Command timeout.")
      }
    },
    async ({ scenePath, timeoutMs }) => {
      const result = await wrapUnityTool("unity_load_scene", "load_scene", { scenePath }, timeoutMs);
      return toolResult(result);
    }
  );

  server.registerTool(
    "unity_save_as_prefab",
    {
      title: "Unity Save As Prefab",
      description: "Save a GameObject hierarchy as a prefab asset.",
      inputSchema: {
        objectPath: z.string().min(1).describe("Hierarchy path of root GameObject."),
        prefabPath: z.string().min(1).describe("Target prefab path under Assets/."),
        timeoutMs: z.number().int().min(0).max(30_000).default(5_000).describe("Command timeout.")
      }
    },
    async ({ objectPath, prefabPath, timeoutMs }) => {
      const result = await wrapUnityTool(
        "unity_save_as_prefab",
        "save_as_prefab",
        { objectPath, prefabPath },
        timeoutMs
      );
      return toolResult(result);
    }
  );

  server.registerTool(
    "unity_instantiate_prefab",
    {
      title: "Unity Instantiate Prefab",
      description: "Instantiate a prefab into the active scene.",
      inputSchema: {
        prefabPath: z.string().min(1).describe("Prefab path under Assets/."),
        parentPath: z.string().default("").describe("Optional parent GameObject path."),
        name: z.string().default("").describe("Optional instance name."),
        timeoutMs: z.number().int().min(0).max(30_000).default(5_000).describe("Command timeout.")
      }
    },
    async ({ prefabPath, parentPath, name, timeoutMs }) => {
      const result = await wrapUnityTool(
        "unity_instantiate_prefab",
        "instantiate_prefab",
        { prefabPath, parentPath, name },
        timeoutMs
      );
      return toolResult(result);
    }
  );
}
