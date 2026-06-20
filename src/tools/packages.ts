import { z } from "zod";
import type { ToolDef, CommandResult } from "../types.js";
import { sq } from "./uci.js";

function parseList(stdout: string) {
  return stdout.split("\n").filter(Boolean).map((line) => {
    const [name, version] = line.split(" - ");
    return { name: name?.trim(), version: version?.trim() };
  });
}

const opkgUpdate: ToolDef = {
  name: "opkg_update",
  description: "Update the opkg package lists.",
  schema: z.object({}),
  risk: () => "mutate",
  build: () => ({ commands: ["opkg update"] }),
  parse: (o: CommandResult[]) => ({ output: o[0].stdout }),
};

const opkgList: ToolDef = {
  name: "opkg_list",
  description: "List available packages (optionally filtered by a name pattern).",
  schema: z.object({ filter: z.string().optional() }),
  risk: () => "read",
  build: (i: { filter?: string }) => ({
    commands: [i.filter ? `opkg list | grep -i ${sq(i.filter)} || true` : "opkg list"],
  }),
  parse: (o: CommandResult[]) => parseList(o[0].stdout),
};

const opkgListInstalled: ToolDef = {
  name: "opkg_list_installed",
  description: "List installed packages.",
  schema: z.object({}),
  risk: () => "read",
  build: () => ({ commands: ["opkg list-installed"] }),
  parse: (o: CommandResult[]) => parseList(o[0].stdout),
};

const opkgInstall: ToolDef = {
  name: "opkg_install",
  description: "Install a package via opkg.",
  schema: z.object({ package: z.string() }),
  risk: () => "mutate",
  build: (i: { package: string }) => ({ commands: [`opkg install ${sq(i.package)}`] }),
  parse: (o: CommandResult[]) => ({ output: o[0].stdout }),
};

const opkgRemove: ToolDef = {
  name: "opkg_remove",
  description: "Remove a package via opkg.",
  schema: z.object({ package: z.string() }),
  risk: () => "mutate",
  build: (i: { package: string }) => ({ commands: [`opkg remove ${sq(i.package)}`] }),
  parse: (o: CommandResult[]) => ({ output: o[0].stdout }),
};

export const packageTools: ToolDef[] = [
  opkgUpdate, opkgList, opkgListInstalled, opkgInstall, opkgRemove,
];
