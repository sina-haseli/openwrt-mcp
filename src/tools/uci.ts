import { z } from "zod";
import type { ToolDef, CommandResult } from "../types.js";

// POSIX single-quote escape: wrap in '...' and replace ' with '\''
export function sq(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

const RISKY_CONFIGS = new Set(["network", "firewall"]);
const previewChanges = () => ["uci changes"];
const parseChanges = (o: CommandResult[]) => o[0]?.stdout ?? "";

const uciShow: ToolDef = {
  name: "uci_show",
  description: "Show a UCI config (or all). Read-only.",
  schema: z.object({ config: z.string().optional() }),
  risk: () => "read",
  build: (i: { config?: string }) => ({ commands: [i.config ? `uci show ${sq(i.config)}` : "uci show"] }),
  parse: (o: CommandResult[]) => o[0].stdout,
};

const uciGet: ToolDef = {
  name: "uci_get",
  description: "Get a single UCI value, e.g. network.lan.proto.",
  schema: z.object({ key: z.string() }),
  risk: () => "read",
  build: (i: { key: string }) => ({ commands: [`uci -q get ${sq(i.key)}`] }),
  parse: (o: CommandResult[], i: { key: string }) => ({ key: i.key, value: o[0].stdout.trim() }),
};

const uciChanges: ToolDef = {
  name: "uci_changes",
  description: "Show staged (uncommitted) UCI changes.",
  schema: z.object({}),
  risk: () => "read",
  build: () => ({ commands: ["uci changes"] }),
  parse: (o: CommandResult[]) => o[0].stdout,
};

const uciSet: ToolDef = {
  name: "uci_set",
  description: "Stage a UCI value change (does not commit). e.g. key=network.lan.proto value=dhcp.",
  schema: z.object({ key: z.string(), value: z.string() }),
  risk: () => "mutate",
  build: (i: { key: string; value: string }) => ({ commands: [`uci set ${sq(i.key)}=${sq(i.value)}`] }),
  parse: () => ({ staged: true }),
  previewCommands: previewChanges,
  previewParse: parseChanges,
};

const uciDelete: ToolDef = {
  name: "uci_delete",
  description: "Stage deletion of a UCI option or section (does not commit).",
  schema: z.object({ key: z.string() }),
  risk: () => "mutate",
  build: (i: { key: string }) => ({ commands: [`uci delete ${sq(i.key)}`] }),
  parse: () => ({ staged: true }),
  previewCommands: previewChanges,
  previewParse: parseChanges,
};

const uciRevert: ToolDef = {
  name: "uci_revert",
  description: "Discard staged changes for a config (or all).",
  schema: z.object({ config: z.string().optional() }),
  risk: () => "mutate",
  build: (i: { config?: string }) => ({ commands: [i.config ? `uci revert ${sq(i.config)}` : "uci revert"] }),
  parse: () => ({ reverted: true }),
  previewCommands: previewChanges,
  previewParse: parseChanges,
};

const uciCommit: ToolDef = {
  name: "uci_commit",
  description: "Commit staged UCI changes for a config (or all). Risky for network/firewall.",
  schema: z.object({ config: z.string().optional() }),
  risk: (i: { config?: string }) => (i.config && RISKY_CONFIGS.has(i.config) ? "risky" : "mutate"),
  build: (i: { config?: string }) => ({
    commands: [i.config ? `uci commit ${sq(i.config)}` : "uci commit"],
    warning:
      i.config && RISKY_CONFIGS.has(i.config)
        ? `Committing '${i.config}' changes the network/firewall you are connected through. ` +
          "A mistake can sever SSH access — have console/failsafe access ready."
        : undefined,
  }),
  parse: () => ({ committed: true }),
  previewCommands: previewChanges,
  previewParse: parseChanges,
};

export const uciTools: ToolDef[] = [
  uciShow, uciGet, uciChanges, uciSet, uciDelete, uciRevert, uciCommit,
];
