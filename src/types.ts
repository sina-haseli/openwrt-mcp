export type RiskClass = "read" | "mutate" | "risky";

export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

export type AuthConfig =
  | { type: "key"; privateKeyPath: string; passphrase?: string }
  | { type: "password"; password: string };

export interface RouterConfig {
  name: string;
  host: string;
  port: number;
  username: string;
  auth: AuthConfig;
  readonly: boolean;
  default: boolean;
}

// The only network boundary. Mocked in every tool test.
export interface SshExecutor {
  exec(
    router: RouterConfig,
    command: string,
    opts?: { timeoutMs?: number }
  ): Promise<CommandResult>;
}

export interface ToolContext {
  ssh: SshExecutor;
  resolveRouter(name?: string): RouterConfig;
}

// A single declarative tool definition. The runner (safety.ts) interprets it.
export interface ToolDef<I = any> {
  name: string;
  description: string;
  // zod schema for the tool's own params (NOT including confirm/router, which the runner adds)
  schema: import("zod").ZodType<I>;
  // per-command SSH timeout override in milliseconds (defaults to 30000)
  timeoutMs?: number;
  // risk is a function because e.g. uci_commit is "risky" for network/firewall, else "mutate"
  risk(input: I): RiskClass;
  // shell commands to execute (in order) when running/confirming
  build(input: I): { commands: string[]; warning?: string };
  // parse raw command outputs into the structured tool result
  parse(outputs: CommandResult[], input: I): unknown;
  // OPTIONAL: read-only commands run during an unconfirmed preview (e.g. `uci changes`)
  previewCommands?(input: I): string[];
  // OPTIONAL: turn preview command outputs into human-readable diff text
  previewParse?(outputs: CommandResult[], input: I): string;
}
