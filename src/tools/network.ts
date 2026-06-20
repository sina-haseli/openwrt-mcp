import { z } from "zod";
import type { ToolDef, CommandResult } from "../types.js";

const empty = z.object({});

const netInterfaces: ToolDef = {
  name: "net_interfaces",
  description: "List network interfaces with status and protocol.",
  schema: empty,
  risk: () => "read",
  build: () => ({ commands: ["ubus call network.interface dump"] }),
  parse: (o: CommandResult[]) => {
    const d = JSON.parse(o[0].stdout || "{}");
    return (d.interface ?? []).map((i: any) => ({
      name: i.interface, up: i.up, proto: i.proto, device: i.l3_device ?? i.device,
      ipv4: i["ipv4-address"], ipv6: i["ipv6-address"], uptime: i.uptime,
    }));
  },
};

const netDhcpLeases: ToolDef = {
  name: "net_dhcp_leases",
  description: "Active DHCP leases (mac, ip, hostname, expiry).",
  schema: empty,
  risk: () => "read",
  build: () => ({ commands: ["cat /tmp/dhcp.leases 2>/dev/null || true"] }),
  parse: (o: CommandResult[]) =>
    o[0].stdout.split("\n").filter(Boolean).map((line) => {
      const [expires, mac, ip, hostname, clientId] = line.trim().split(/\s+/);
      return { expires: Number(expires), mac, ip, hostname: hostname === "*" ? null : hostname, clientId };
    }),
};

const netWifiClients: ToolDef = {
  name: "net_wifi_clients",
  description: "Associated wifi clients per radio interface.",
  schema: empty,
  risk: () => "read",
  build: () => ({
    commands: [
      "for i in $(iwinfo 2>/dev/null | grep ESSID | cut -d' ' -f1); do echo \"# $i\"; iwinfo $i assoclist; done",
    ],
  }),
  parse: (o: CommandResult[]) => {
    const result: Record<string, any[]> = {};
    let iface = "";
    for (const line of o[0].stdout.split("\n")) {
      const h = /^# (\S+)/.exec(line);
      if (h) { iface = h[1]; result[iface] = []; continue; }
      const m = /^([0-9A-Fa-f:]{17})\s+(-?\d+)\s*dBm/.exec(line.trim());
      if (m && iface) result[iface].push({ mac: m[1], signalDbm: Number(m[2]) });
    }
    return result;
  },
};

const netRoutes: ToolDef = {
  name: "net_routes",
  description: "IPv4 routing table.",
  schema: empty,
  risk: () => "read",
  build: () => ({ commands: ["ip -4 route show"] }),
  parse: (o: CommandResult[]) => o[0].stdout.split("\n").filter(Boolean).map((l) => l.trim()),
};

const netArp: ToolDef = {
  name: "net_arp",
  description: "ARP / neighbor table (ip -> mac -> device).",
  schema: empty,
  risk: () => "read",
  build: () => ({ commands: ["cat /proc/net/arp"] }),
  parse: (o: CommandResult[]) =>
    o[0].stdout.split("\n").slice(1).filter(Boolean).map((line) => {
      const cols = line.trim().split(/\s+/);
      return { ip: cols[0], mac: cols[3], device: cols[5] };
    }).filter((e) => e.mac && e.mac !== "00:00:00:00:00:00"),
};

export const networkTools: ToolDef[] = [netInterfaces, netDhcpLeases, netWifiClients, netRoutes, netArp];
