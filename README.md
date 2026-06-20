# openwrt-mcp

An MCP server that gives an AI assistant full administrative control of OpenWRT
router(s) over SSH, with typed tools and a preview→confirm safety model.

## Install

```bash
npm install && npm run build
```

## Configure

Copy `openwrt-mcp.config.example.json` to `openwrt-mcp.config.json` and edit:

```json
{
  "routers": {
    "home": {
      "host": "192.168.1.1",
      "port": 22,
      "username": "root",
      "auth": { "type": "key", "privateKeyPath": "~/.ssh/id_ed25519" },
      "readonly": false,
      "default": true
    }
  }
}
```

- Password auth: `"auth": { "type": "password", "password": "${RTR_PW}" }` (the
  `${RTR_PW}` form reads the value from that environment variable).
- `readonly: true` hard-blocks all mutating tools on that router.

Config path override: set `OPENWRT_MCP_CONFIG=/path/to/config.json`.

## Run / connect

Add to your MCP client (e.g. Claude Desktop / Claude Code) as a stdio server:

```json
{
  "mcpServers": {
    "openwrt": {
      "command": "node",
      "args": ["/absolute/path/to/openwrt-mcp/dist/index.js"],
      "env": { "OPENWRT_MCP_CONFIG": "/absolute/path/to/openwrt-mcp.config.json" }
    }
  }
}
```

## Safety model

- **read** tools run immediately.
- **mutate** / **risky** tools require a two-step call: the first call (without
  `confirm: true`) returns a preview (the exact commands + a `uci changes` diff
  where relevant); call again with `confirm: true` to execute.
- **risky** tools (firewall, network commit, reboot, raw shell) add a lock-out
  warning.

## Tools

system_info, system_resources, reboot, net_interfaces, net_dhcp_leases,
net_wifi_clients, net_routes, net_arp, uci_show, uci_get, uci_changes, uci_set,
uci_delete, uci_revert, uci_commit, wifi_radios, wifi_set_enabled,
wifi_configure, fw_list, fw_add_rule, fw_remove_rule, opkg_update, opkg_list,
opkg_list_installed, opkg_install, opkg_remove, service_list, service_control,
service_enabled, log_read, dmesg, run_command.
