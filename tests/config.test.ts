import { describe, it, expect } from "vitest";
import { loadInventory } from "../src/config.js";

const base = {
  routers: {
    home: {
      host: "192.168.1.1", port: 22, username: "root",
      auth: { type: "key", privateKeyPath: "~/.ssh/id_ed25519" },
      default: true,
    },
  },
};

describe("loadInventory", () => {
  it("parses a single router and resolves the default", () => {
    const inv = loadInventory(base);
    const r = inv.resolveRouter();
    expect(r.name).toBe("home");
    expect(r.port).toBe(22);
    expect(r.readonly).toBe(false); // defaulted
  });

  it("resolves a router by name", () => {
    const inv = loadInventory(base);
    expect(inv.resolveRouter("home").host).toBe("192.168.1.1");
  });

  it("throws on unknown router name", () => {
    const inv = loadInventory(base);
    expect(() => inv.resolveRouter("nope")).toThrow(/unknown router/i);
  });

  it("throws when no router name given and no default", () => {
    const inv = loadInventory({
      routers: {
        a: { host: "h", port: 22, username: "root", auth: { type: "password", password: "x" } },
        b: { host: "h2", port: 22, username: "root", auth: { type: "password", password: "y" } },
      },
    });
    expect(() => inv.resolveRouter()).toThrow(/no default router/i);
  });

  it("substitutes a password from env when value is ${ENV_VAR}", () => {
    const inv = loadInventory({
      routers: {
        home: { host: "h", port: 22, username: "root",
          auth: { type: "password", password: "${RTR_PW}" }, default: true },
      },
    }, { RTR_PW: "secret" });
    const r = inv.resolveRouter();
    expect(r.auth.type === "password" && r.auth.password).toBe("secret");
  });

  it("rejects config with no routers", () => {
    expect(() => loadInventory({ routers: {} })).toThrow(/at least one router/i);
  });
});
