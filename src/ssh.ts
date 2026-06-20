import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { Client } from "ssh2";
import type { SshExecutor, RouterConfig, CommandResult } from "./types.js";

// Minimal surface of ssh2.Client that we depend on (keeps tests honest).
export interface SshClientLike {
  on(event: string, cb: (...args: any[]) => void): unknown;
  connect(opts: Record<string, unknown>): void;
  exec(command: string, cb: (err: Error | undefined, stream: any) => void): void;
  end(): void;
}

export interface SshDeps {
  connect?: () => SshClientLike;
}

function expandHome(p: string): string {
  return p.startsWith("~") ? p.replace(/^~/, homedir()) : p;
}

function connectOptions(router: RouterConfig): Record<string, unknown> {
  const base = { host: router.host, port: router.port, username: router.username, readyTimeout: 20000 };
  if (router.auth.type === "password") return { ...base, password: router.auth.password };
  return {
    ...base,
    privateKey: readFileSync(expandHome(router.auth.privateKeyPath)),
    passphrase: router.auth.passphrase,
  };
}

export function createSshExecutor(deps: SshDeps = {}): SshExecutor {
  const makeClient = deps.connect ?? (() => new Client() as unknown as SshClientLike);

  return {
    exec(router, command, opts = {}): Promise<CommandResult> {
      const timeoutMs = opts.timeoutMs ?? 30000;
      return new Promise<CommandResult>((resolve, reject) => {
        const client = makeClient();
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          client.end();
          reject(new Error(`command timed out after ${timeoutMs}ms: ${command}`));
        }, timeoutMs);

        const finish = (fn: () => void) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          client.end();
          fn();
        };

        client.on("error", (err: Error) => finish(() => reject(err)));
        client.on("ready", () => {
          if (settled) return;
          client.exec(command, (err, stream) => {
            if (err) return finish(() => reject(err));
            let stdout = "";
            let stderr = "";
            stream.on("data", (d: Buffer) => (stdout += d.toString()));
            stream.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
            stream.on("close", (code: number) =>
              finish(() => resolve({ stdout, stderr, code: code ?? 0 }))
            );
          });
        });

        client.connect(connectOptions(router));
      });
    },
  };
}
