import { z } from "zod";
import type { ToolDef, CommandResult } from "../types.js";
import { sq } from "./uci.js";

const logRead: ToolDef = {
  name: "log_read",
  description: "Read the system log (logread), optionally filtered, last N lines.",
  schema: z.object({
    lines: z.number().int().positive().max(1000).default(100),
    filter: z.string().optional(),
  }),
  risk: () => "read",
  build: (i: { lines: number; filter?: string }) => ({
    commands: [
      i.filter
        ? `logread | grep -i ${sq(i.filter)} | tail -n ${i.lines}`
        : `logread | tail -n ${i.lines}`,
    ],
  }),
  parse: (o: CommandResult[]) => ({ lines: o[0].stdout.split("\n").filter(Boolean) }),
};

const dmesg: ToolDef = {
  name: "dmesg",
  description: "Read the kernel ring buffer (dmesg), last N lines.",
  schema: z.object({ lines: z.number().int().positive().max(1000).default(100) }),
  risk: () => "read",
  build: (i: { lines: number }) => ({ commands: [`dmesg | tail -n ${i.lines}`] }),
  parse: (o: CommandResult[]) => ({ lines: o[0].stdout.split("\n").filter(Boolean) }),
};

export const logTools: ToolDef[] = [logRead, dmesg];
