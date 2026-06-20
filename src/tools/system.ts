import { z } from "zod";
import type { ToolDef, CommandResult } from "../types.js";

const empty = z.object({});

const systemInfo: ToolDef = {
  name: "system_info",
  description: "Board model, OpenWRT version, kernel and target.",
  schema: empty,
  risk: () => "read",
  build: () => ({ commands: ["ubus call system board"] }),
  parse: (o: CommandResult[]) => {
    const b = JSON.parse(o[0].stdout || "{}");
    return {
      model: b.model,
      boardName: b.board_name,
      kernel: b.kernel,
      version: b.release?.version,
      target: b.release?.target,
      description: b.release?.description,
    };
  },
};

const systemResources: ToolDef = {
  name: "system_resources",
  description: "Uptime, load average, and memory usage.",
  schema: empty,
  risk: () => "read",
  build: () => ({ commands: ["ubus call system info"] }),
  parse: (o: CommandResult[]) => {
    const i = JSON.parse(o[0].stdout || "{}");
    return {
      uptimeSeconds: i.uptime,
      load: Array.isArray(i.load) ? i.load.map((n: number) => +(n / 65536).toFixed(2)) : i.load,
      memory: i.memory,
      swap: i.swap,
    };
  },
};

const reboot: ToolDef = {
  name: "reboot",
  description: "Reboot the router. Risky: connectivity will drop until it comes back.",
  schema: empty,
  risk: () => "risky",
  build: () => ({
    commands: ["reboot"],
    warning:
      "This will REBOOT the router. SSH/network access will drop until it finishes booting. " +
      "Make sure you have console/failsafe access if it does not come back.",
  }),
  parse: () => ({ rebooting: true }),
};

export const systemTools: ToolDef[] = [systemInfo, systemResources, reboot];
