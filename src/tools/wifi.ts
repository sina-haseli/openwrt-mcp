import { z } from "zod";
import type { ToolDef, CommandResult } from "../types.js";
import { sq } from "./uci.js";

const previewChanges = () => ["uci changes"];
const parseChanges = (o: CommandResult[]) => o[0]?.stdout ?? "";

const wifiRadios: ToolDef = {
  name: "wifi_radios",
  description: "Show wifi radios (wifi-device) and interfaces (wifi-iface) from UCI.",
  schema: z.object({}),
  risk: () => "read",
  build: () => ({ commands: ["uci show wireless"] }),
  parse: (o: CommandResult[]) => {
    const devices: Record<string, any> = {};
    const interfaces: Record<string, any> = {};
    for (const line of o[0].stdout.split("\n").filter(Boolean)) {
      const m = /^wireless\.([^.=]+)(?:\.([^=]+))?=(.*)$/.exec(line);
      if (!m) continue;
      const [, sect, opt, rawVal] = m;
      const val = rawVal.replace(/^'(.*)'$/, "$1");
      const isIface = val === "wifi-iface" || interfaces[sect];
      const target = opt ? (sect in devices ? devices : isIface ? interfaces : devices) : (val === "wifi-iface" ? interfaces : devices);
      target[sect] = target[sect] ?? {};
      if (opt) target[sect][opt] = val; else target[sect].type = val;
    }
    return { devices, interfaces };
  },
};

const wifiSetEnabled: ToolDef = {
  name: "wifi_set_enabled",
  description: "Enable or disable a wifi radio (wifi-device), then reload wifi.",
  schema: z.object({ device: z.string(), enabled: z.boolean() }),
  risk: () => "mutate",
  build: (i: { device: string; enabled: boolean }) => ({
    commands: [
      `uci set ${sq(`wireless.${i.device}.disabled`)}=${sq(i.enabled ? "0" : "1")}`,
      "uci commit wireless",
      "wifi reload",
    ],
  }),
  parse: (_o, i: { device: string; enabled: boolean }) => ({ device: i.device, enabled: i.enabled }),
  previewCommands: previewChanges,
  previewParse: parseChanges,
};

const wifiConfigureSchema = z.object({
  iface: z.string(),
  ssid: z.string().optional(),
  channel: z.string().optional(),
  encryption: z.string().optional(),
  key: z.string().optional(),
  device: z.string().optional(), // for channel changes on the radio
});

const wifiConfigure: ToolDef = {
  name: "wifi_configure",
  description: "Set SSID/channel/encryption/key on a wifi interface, then reload wifi.",
  schema: wifiConfigureSchema,
  risk: () => "mutate",
  build: (i: z.infer<typeof wifiConfigureSchema>) => {
    const cmds: string[] = [];
    if (i.ssid !== undefined) cmds.push(`uci set ${sq(`wireless.${i.iface}.ssid`)}=${sq(i.ssid)}`);
    if (i.encryption !== undefined) cmds.push(`uci set ${sq(`wireless.${i.iface}.encryption`)}=${sq(i.encryption)}`);
    if (i.key !== undefined) cmds.push(`uci set ${sq(`wireless.${i.iface}.key`)}=${sq(i.key)}`);
    if (i.channel !== undefined && i.device)
      cmds.push(`uci set ${sq(`wireless.${i.device}.channel`)}=${sq(i.channel)}`);
    cmds.push("uci commit wireless", "wifi reload");
    return { commands: cmds };
  },
  parse: (_o, i: any) => ({ iface: i.iface, applied: true }),
  previewCommands: previewChanges,
  previewParse: parseChanges,
};

export const wifiTools: ToolDef[] = [wifiRadios, wifiSetEnabled, wifiConfigure];
