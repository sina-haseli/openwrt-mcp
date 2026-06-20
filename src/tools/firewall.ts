import { z } from "zod";
import type { ToolDef, CommandResult } from "../types.js";
import { sq } from "./uci.js";

const LOCKOUT_WARNING =
  "Firewall changes can sever your SSH/network access if they block the management path. " +
  "Verify the rule and have console/failsafe access ready before confirming.";

// Reload that works across fw3 (older) and fw4 (newer) OpenWRT.
const RELOAD = "/etc/init.d/firewall reload";

const previewChanges = () => ["uci changes"];
const parseChanges = (o: CommandResult[]) => o[0]?.stdout ?? "";

const fwList: ToolDef = {
  name: "fw_list",
  description: "Show firewall zones and rules (uci show firewall). Read-only.",
  schema: z.object({}),
  risk: () => "read",
  build: () => ({ commands: ["uci show firewall"] }),
  parse: (o: CommandResult[]) => o[0].stdout,
};

const fwAddRule: ToolDef = {
  name: "fw_add_rule",
  description: "Add a firewall rule (traffic rule) and reload. Risky.",
  schema: z.object({
    name: z.string(),
    src: z.string().optional(),
    dest: z.string().optional(),
    src_port: z.string().optional(),
    dest_port: z.string().optional(),
    proto: z.string().optional(),
    target: z.enum(["ACCEPT", "REJECT", "DROP"]).default("ACCEPT"),
  }),
  risk: () => "risky",
  build: (i: any) => {
    const set = (opt: string, val?: string) =>
      val === undefined ? null : `uci set ${sq(`firewall.$RULE.${opt}`)}=${sq(val)}`;
    const lines = [
      "RULE=$(uci add firewall rule)",
      set("name", i.name),
      set("src", i.src),
      set("dest", i.dest),
      set("src_port", i.src_port),
      set("dest_port", i.dest_port),
      set("proto", i.proto),
      set("target", i.target),
      "uci commit firewall",
      RELOAD,
    ].filter(Boolean) as string[];
    // Combine into one shell invocation so $RULE persists across the sequence.
    return { commands: [lines.join(" && ")], warning: LOCKOUT_WARNING };
  },
  parse: (_o, i: any) => ({ added: i.name }),
  previewCommands: previewChanges,
  previewParse: parseChanges,
};

const fwRemoveRule: ToolDef = {
  name: "fw_remove_rule",
  description: "Remove a firewall section by its config name (e.g. cfg0a) and reload. Risky.",
  schema: z.object({ section: z.string() }),
  risk: () => "risky",
  build: (i: { section: string }) => ({
    commands: [`uci delete ${sq(`firewall.${i.section}`)} && uci commit firewall && ${RELOAD}`],
    warning: LOCKOUT_WARNING,
  }),
  parse: (_o, i: { section: string }) => ({ removed: i.section }),
  previewCommands: previewChanges,
  previewParse: parseChanges,
};

export const firewallTools: ToolDef[] = [fwList, fwAddRule, fwRemoveRule];
