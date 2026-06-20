import { describe, it, expect, vi } from "vitest";
import { runTool } from "../src/safety.js";
import type { ToolDef, ToolContext, RouterConfig, CommandResult } from "../src/types.js";

const router: RouterConfig = {
  name: "home", host: "h", port: 22, username: "root",
  auth: { type: "password", password: "x" }, readonly: false, default: true,
};

function ctxWith(execImpl: (r: RouterConfig, c: string) => Promise<CommandResult>): ToolContext {
  return { ssh: { exec: vi.fn(execImpl) }, resolveRouter: () => router };
}
const ok = (stdout: string): CommandResult => ({ stdout, stderr: "", code: 0 });

const readTool: ToolDef = {
  name: "r", description: "", schema: {} as any,
  risk: () => "read",
  build: () => ({ commands: ["echo hi"] }),
  parse: (o) => ({ out: o[0].stdout.trim() }),
};

const mutateTool: ToolDef = {
  name: "m", description: "", schema: {} as any,
  risk: () => "mutate",
  build: () => ({ commands: ["uci set foo=bar"] }),
  parse: () => ({ done: true }),
  previewCommands: () => ["uci changes"],
  previewParse: (o) => o[0].stdout,
};

describe("runTool", () => {
  it("read tool executes and parses immediately", async () => {
    const ctx = ctxWith(async () => ok("hi"));
    const res = await runTool(readTool, {}, ctx);
    expect(res).toEqual({ ok: true, data: { out: "hi" } });
  });

  it("unconfirmed mutate returns a preview and does NOT run build commands", async () => {
    const exec = vi.fn(async () => ok("network.lan.proto='dhcp'"));
    const ctx: ToolContext = { ssh: { exec }, resolveRouter: () => router };
    const res = await runTool(mutateTool, { confirm: false }, ctx);
    expect(res.ok).toBe(true);
    expect(res.preview?.commands).toEqual(["uci set foo=bar"]);
    expect(res.preview?.diff).toContain("network.lan.proto");
    expect(exec).toHaveBeenCalledTimes(1); // only the preview command
    expect(exec).toHaveBeenCalledWith(router, "uci changes", expect.anything());
  });

  it("confirmed mutate executes build commands", async () => {
    const exec = vi.fn(async () => ok(""));
    const ctx: ToolContext = { ssh: { exec }, resolveRouter: () => router };
    const res = await runTool(mutateTool, { confirm: true }, ctx);
    expect(res).toEqual({ ok: true, data: { done: true } });
    expect(exec).toHaveBeenCalledWith(router, "uci set foo=bar", expect.anything());
  });

  it("readonly router blocks confirmed mutation", async () => {
    const ro = { ...router, readonly: true };
    const ctx: ToolContext = { ssh: { exec: vi.fn(async () => ok("")) }, resolveRouter: () => ro };
    const res = await runTool(mutateTool, { confirm: true }, ctx);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/readonly/i);
  });

  it("non-zero exit code becomes a structured error", async () => {
    const ctx = ctxWith(async () => ({ stdout: "", stderr: "boom", code: 1 }));
    const res = await runTool(readTool, {}, ctx);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/exit code 1/);
    expect(res.error).toMatch(/boom/);
  });

  it("thrown ssh error becomes a structured error", async () => {
    const ctx = ctxWith(async () => { throw new Error("ECONNREFUSED"); });
    const res = await runTool(readTool, {}, ctx);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/ECONNREFUSED/);
  });

  it("risky preview includes the warning from build()", async () => {
    const riskyTool: ToolDef = {
      name: "x", description: "", schema: {} as any,
      risk: () => "risky",
      build: () => ({ commands: ["reboot"], warning: "router will reboot" }),
      parse: () => ({ ok: true }),
    };
    const ctx = ctxWith(async () => ok(""));
    const res = await runTool(riskyTool, {}, ctx);
    expect(res.preview?.warning).toBe("router will reboot");
    expect(res.preview?.risk).toBe("risky");
  });
});
