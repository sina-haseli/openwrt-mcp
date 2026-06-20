import { describe, it, expect, vi } from "vitest";
import { buildServer } from "../src/server.js";
import { allTools } from "../src/tools/index.js";
import type { ToolContext, RouterConfig, CommandResult } from "../src/types.js";

const router: RouterConfig = {
  name: "home", host: "h", port: 22, username: "root",
  auth: { type: "password", password: "x" }, readonly: false, default: true,
};

describe("allTools registry", () => {
  it("contains all categories with unique names", () => {
    const names = allTools.map((t) => t.name);
    expect(names).toContain("system_info");
    expect(names).toContain("uci_set");
    expect(names).toContain("run_command");
    expect(new Set(names).size).toBe(names.length); // no duplicates
    expect(names.length).toBeGreaterThanOrEqual(24);
  });
});

describe("buildServer", () => {
  it("registers a tool per definition without throwing", () => {
    const ctx: ToolContext = {
      ssh: { exec: vi.fn(async (): Promise<CommandResult> => ({ stdout: "", stderr: "", code: 0 })) },
      resolveRouter: () => router,
    };
    const server = buildServer(ctx);
    expect(server).toBeDefined();
  });
});
