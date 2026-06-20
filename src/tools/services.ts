import { z } from "zod";
import type { ToolDef, CommandResult } from "../types.js";
import { sq } from "./uci.js";

const serviceList: ToolDef = {
  name: "service_list",
  description: "List available init.d services.",
  schema: z.object({}),
  risk: () => "read",
  build: () => ({ commands: ["ls /etc/init.d"] }),
  parse: (o: CommandResult[]) => o[0].stdout.split("\n").map((s) => s.trim()).filter(Boolean),
};

const serviceControl: ToolDef = {
  name: "service_control",
  description: "Start/stop/restart/reload an init.d service.",
  schema: z.object({
    service: z.string(),
    action: z.enum(["start", "stop", "restart", "reload"]),
  }),
  risk: () => "mutate",
  build: (i: { service: string; action: string }) => ({
    commands: [`/etc/init.d/${sq(i.service)} ${i.action}`],
  }),
  parse: (_o, i: { service: string; action: string }) => ({ service: i.service, action: i.action, done: true }),
};

const serviceEnabled: ToolDef = {
  name: "service_enabled",
  description: "Enable or disable an init.d service at boot.",
  schema: z.object({ service: z.string(), enabled: z.boolean() }),
  risk: () => "mutate",
  build: (i: { service: string; enabled: boolean }) => ({
    commands: [`/etc/init.d/${sq(i.service)} ${i.enabled ? "enable" : "disable"}`],
  }),
  parse: (_o, i: { service: string; enabled: boolean }) => ({ service: i.service, enabled: i.enabled }),
};

export const serviceTools: ToolDef[] = [serviceList, serviceControl, serviceEnabled];
