import { z } from "zod";
import type { ToolDef, CommandResult } from "../types.js";

const runCommand: ToolDef = {
  name: "run_command",
  description: "Run an arbitrary shell command on the router. Risky escape hatch.",
  schema: z.object({ command: z.string() }),
  risk: () => "risky",
  build: (i: { command: string }) => ({
    commands: [i.command],
    warning:
      "This runs an arbitrary/raw command on the router. Review the exact command above before confirming.",
  }),
  parse: (o: CommandResult[]) => ({ stdout: o[0].stdout, stderr: o[0].stderr, code: o[0].code }),
};

export const shellTools: ToolDef[] = [runCommand];
