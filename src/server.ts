import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolContext, ToolDef } from "./types.js";
import { runTool } from "./safety.js";
import { allTools } from "./tools/index.js";

export function buildServer(ctx: ToolContext, tools: ToolDef[] = allTools): McpServer {
  const server = new McpServer({ name: "openwrt-mcp", version: "0.1.0" });

  for (const def of tools) {
    // The tool's own params, plus the runner-managed router/confirm fields.
    const base = (def.schema as z.ZodObject<any>).shape ?? {};
    const isRead = def.risk({} as any) === "read"; // best-effort; risk fns are param-light for read tools
    const shape: Record<string, z.ZodTypeAny> = {
      ...base,
      router: z.string().optional().describe("Target router name (defaults to the configured default)."),
    };
    if (!isRead) {
      shape.confirm = z
        .boolean()
        .optional()
        .describe("Set true to execute. Omit/false to get a safe preview first.");
    }

    server.tool(def.name, def.description, shape, async (args: Record<string, unknown>) => {
      const result = await runTool(def, args, ctx);
      return {
        isError: !result.ok,
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    });
  }

  return server;
}
