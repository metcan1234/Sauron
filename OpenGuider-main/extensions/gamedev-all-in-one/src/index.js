import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "gamedev-all-in-one",
  version: "1.0.0",
});

const state = {
  objects: {},
  nextId: 1,
};

server.tool(
  "create_scene",
  { name: z.string().describe("Scene name") },
  async ({ name }) => {
    state.objects = {};
    state.nextId = 1;
    return {
      content: [{ type: "text", text: JSON.stringify({ ok: true, scene: name, objectCount: 0 }) }],
    };
  }
);

server.tool(
  "add_object",
  {
    type: z.string().describe("Object type (e.g. cube, sphere, plane)"),
    name: z.string().optional().describe("Display name"),
    x: z.number().optional().default(0),
    y: z.number().optional().default(0),
    z: z.number().optional().default(0),
  },
  async ({ type, name, x, y, z }) => {
    const id = String(state.nextId++);
    const obj = { id, type, name: name || `${type}_${id}`, position: { x, y, z } };
    state.objects[id] = obj;
    return {
      content: [{ type: "text", text: JSON.stringify({ ok: true, object: obj }) }],
    };
  }
);

server.tool(
  "set_position",
  {
    objectId: z.string().describe("Object ID to move"),
    x: z.number(),
    y: z.number(),
    z: z.number(),
  },
  async ({ objectId, x, y, z }) => {
    const obj = state.objects[objectId];
    if (!obj) {
      return { content: [{ type: "text", text: JSON.stringify({ ok: false, error: `Object ${objectId} not found` }) }] };
    }
    obj.position = { x, y, z };
    return {
      content: [{ type: "text", text: JSON.stringify({ ok: true, object: obj }) }],
    };
  }
);

server.tool(
  "get_scene_info",
  {},
  async () => {
    const entries = Object.values(state.objects);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          ok: true,
          objectCount: entries.length,
          objects: entries,
        }),
      }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
