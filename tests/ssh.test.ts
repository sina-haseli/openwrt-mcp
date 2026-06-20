import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { createSshExecutor } from "../src/ssh.js";
import type { RouterConfig } from "../src/types.js";

const router: RouterConfig = {
  name: "home", host: "h", port: 22, username: "root",
  auth: { type: "password", password: "pw" }, readonly: false, default: true,
};

// Fake ssh2 Client: emits "ready" on connect, streams a canned result on exec.
function fakeClient(stdout: string, stderr: string, code: number) {
  const client: any = new EventEmitter();
  client.connect = (_opts: any) => queueMicrotask(() => client.emit("ready"));
  client.end = vi.fn();
  client.exec = (_cmd: string, cb: (e: Error | undefined, stream: any) => void) => {
    const stream: any = new EventEmitter();
    stream.stderr = new EventEmitter();
    cb(undefined, stream);
    queueMicrotask(() => {
      if (stdout) stream.emit("data", Buffer.from(stdout));
      if (stderr) stream.stderr.emit("data", Buffer.from(stderr));
      stream.emit("close", code);
    });
  };
  return client;
}

describe("createSshExecutor", () => {
  it("runs a command and returns stdout/stderr/code", async () => {
    const connect = vi.fn(() => fakeClient("hello\n", "", 0));
    const ssh = createSshExecutor({ connect });
    const res = await ssh.exec(router, "echo hello");
    expect(res).toEqual({ stdout: "hello\n", stderr: "", code: 0 });
    expect(connect).toHaveBeenCalledOnce();
  });

  it("captures stderr and non-zero exit code", async () => {
    const ssh = createSshExecutor({ connect: () => fakeClient("", "nope\n", 2) });
    const res = await ssh.exec(router, "false");
    expect(res.stderr).toBe("nope\n");
    expect(res.code).toBe(2);
  });

  it("passes password auth in connect options", async () => {
    let opts: any;
    const connect = vi.fn(() => {
      const c = fakeClient("", "", 0);
      const orig = c.connect;
      c.connect = (o: any) => { opts = o; orig(o); };
      return c;
    });
    const ssh = createSshExecutor({ connect });
    await ssh.exec(router, "true");
    expect(opts).toMatchObject({ host: "h", port: 22, username: "root", password: "pw" });
  });

  it("rejects when the connection errors", async () => {
    const connect = () => {
      const c: any = new EventEmitter();
      c.connect = () => queueMicrotask(() => c.emit("error", new Error("ECONNREFUSED")));
      c.end = vi.fn();
      return c;
    };
    const ssh = createSshExecutor({ connect });
    await expect(ssh.exec(router, "true")).rejects.toThrow(/ECONNREFUSED/);
  });

  it("times out a hung command", async () => {
    const connect = () => {
      const c: any = new EventEmitter();
      c.connect = () => queueMicrotask(() => c.emit("ready"));
      c.exec = (_cmd: string, cb: any) => cb(undefined, new EventEmitter()); // never closes
      c.end = vi.fn();
      return c;
    };
    const ssh = createSshExecutor({ connect });
    await expect(ssh.exec(router, "sleep 999", { timeoutMs: 20 })).rejects.toThrow(/timed out/i);
  });
});
