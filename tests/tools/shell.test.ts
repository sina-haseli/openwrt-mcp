import { describe, it, expect, vi } from "vitest";
import { shellTools } from "../../src/tools/shell.js";
import { runTool } from "../../src/safety.js";
import type { ToolContext, RouterConfig, CommandResult } from "../../src/types.js";

const router: RouterConfig = {
  name: "home", host: "h", port: 22, username: "root",
  auth: { type: "password", password: "x" }, readonly: false, default: true,
};
const ok = (s: string): CommandResult => ({ stdout: s, stderr: "", code: 0 });
function ctx(map: Record<string, string> = {}): ToolContext {
  return { ssh: { exec: vi.fn(async (_r, cmd: string) => ok(map[cmd] ?? "")) }, resolveRouter: () => router };
}
const tool = () => shellTools[0];

describe("run_command", () => {
  it("is risky and previews the exact command unconfirmed", async () => {
    const c = ctx();
    const res = await runTool(tool(), { command: "rm -rf /tmp/x" }, c);
    expect(res.preview?.risk).toBe("risky");
    expect(res.preview?.commands).toEqual(["rm -rf /tmp/x"]);
    expect(res.preview?.warning).toMatch(/arbitrary|raw|review/i);
    expect(c.ssh.exec).not.toHaveBeenCalled();
  });

  it("executes verbatim when confirmed and returns stdout/stderr/code", async () => {
    const c = ctx({ "uname -a": "Linux OpenWrt\n" });
    const res = await runTool(tool(), { command: "uname -a", confirm: true }, c);
    expect(res.data).toEqual({ stdout: "Linux OpenWrt\n", stderr: "", code: 0 });
    expect(c.ssh.exec).toHaveBeenCalledWith(router, "uname -a", expect.anything());
  });
});
