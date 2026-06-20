import type { ToolDef, ToolContext, CommandResult, RiskClass } from "./types.js";

export interface RunInput {
  router?: string;
  confirm?: boolean;
  [k: string]: unknown;
}

export interface RunResult {
  ok: boolean;
  data?: unknown;
  preview?: { commands: string[]; diff?: string; warning?: string; risk: RiskClass };
  error?: string;
}

async function execAll(
  ctx: ToolContext,
  router: ReturnType<ToolContext["resolveRouter"]>,
  commands: string[]
): Promise<CommandResult[]> {
  const results: CommandResult[] = [];
  for (const cmd of commands) {
    const r = await ctx.ssh.exec(router, cmd, { timeoutMs: 30000 });
    if (r.code !== 0) {
      throw new Error(`command failed (exit code ${r.code}): ${cmd}\n${r.stderr}`);
    }
    results.push(r);
  }
  return results;
}

export async function runTool(
  def: ToolDef,
  rawInput: RunInput,
  ctx: ToolContext
): Promise<RunResult> {
  try {
    const { router: routerName, confirm, ...input } = rawInput;
    const router = ctx.resolveRouter(routerName);
    const risk = def.risk(input);

    if (risk === "read") {
      const outputs = await execAll(ctx, router, def.build(input).commands);
      return { ok: true, data: def.parse(outputs, input) };
    }

    // mutate or risky
    if (!confirm) {
      const built = def.build(input);
      let diff: string | undefined;
      if (def.previewCommands) {
        const pcmds = def.previewCommands(input);
        const pout = await execAll(ctx, router, pcmds);
        diff = def.previewParse ? def.previewParse(pout, input) : pout.map((o) => o.stdout).join("\n");
      }
      return { ok: true, preview: { commands: built.commands, diff, warning: built.warning, risk } };
    }

    if (router.readonly) {
      return { ok: false, error: `router '${router.name}' is readonly; mutation blocked` };
    }

    const outputs = await execAll(ctx, router, def.build(input).commands);
    return { ok: true, data: def.parse(outputs, input) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
