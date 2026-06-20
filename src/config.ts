import { z } from "zod";
import type { RouterConfig } from "./types.js";

const authSchema = z.union([
  z.object({
    type: z.literal("key"),
    privateKeyPath: z.string(),
    passphrase: z.string().optional(),
  }),
  z.object({ type: z.literal("password"), password: z.string() }),
]);

const routerSchema = z.object({
  host: z.string(),
  port: z.number().int().default(22),
  username: z.string().default("root"),
  auth: authSchema,
  readonly: z.boolean().default(false),
  default: z.boolean().default(false),
});

const inventorySchema = z.object({ routers: z.record(routerSchema) });

export interface Inventory {
  routers: Record<string, RouterConfig>;
  resolveRouter(name?: string): RouterConfig;
}

function subst(value: string, env: Record<string, string | undefined>): string {
  const m = /^\$\{([A-Z0-9_]+)\}$/.exec(value);
  if (!m) return value;
  const v = env[m[1]];
  if (v === undefined) throw new Error(`env var ${m[1]} is not set`);
  return v;
}

export function loadInventory(
  raw: unknown,
  env: Record<string, string | undefined> = process.env
): Inventory {
  const parsed = inventorySchema.parse(raw);
  const names = Object.keys(parsed.routers);
  if (names.length === 0) throw new Error("config must define at least one router");

  const routers: Record<string, RouterConfig> = {};
  for (const name of names) {
    const r = parsed.routers[name];
    const auth =
      r.auth.type === "password"
        ? { ...r.auth, password: subst(r.auth.password, env) }
        : { ...r.auth, privateKeyPath: subst(r.auth.privateKeyPath, env) };
    routers[name] = { name, ...r, auth };
  }

  return {
    routers,
    resolveRouter(name?: string): RouterConfig {
      if (name) {
        const r = routers[name];
        if (!r) throw new Error(`unknown router: ${name}`);
        return r;
      }
      const defaults = Object.values(routers).filter((r) => r.default);
      if (defaults.length === 1) return defaults[0];
      if (names.length === 1) return routers[names[0]];
      throw new Error("no default router; specify a router name");
    },
  };
}
