import { readFileSync } from "node:fs";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadInventory } from "./config.js";
import { createSshExecutor } from "./ssh.js";
import { buildServer } from "./server.js";
import type { ToolContext } from "./types.js";

async function main() {
  const configPath = process.env.OPENWRT_MCP_CONFIG ?? "./openwrt-mcp.config.json";
  const raw = JSON.parse(readFileSync(configPath, "utf8"));
  const inventory = loadInventory(raw);
  const ssh = createSshExecutor();

  const ctx: ToolContext = {
    ssh,
    resolveRouter: (name) => inventory.resolveRouter(name),
  };

  const server = buildServer(ctx);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("openwrt-mcp failed to start:", err);
  process.exit(1);
});
