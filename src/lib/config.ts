import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { officeRoot } from "./paths.js";

const configSchema = z.object({
  runner: z.enum(["claude", "opencode"]).nullable().default("opencode"),
  timeouts: z
    .object({
      personaRunMs: z.number().int().default(600_000),
    })
    .default({}),
  maxRounds: z.number().int().default(50),
});

export type Config = z.infer<typeof configSchema>;

export function readConfig(projectRoot: string): Config {
  const file = path.join(officeRoot(projectRoot), "config.json");
  if (!fs.existsSync(file)) return configSchema.parse({});
  try {
    return configSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    return configSchema.parse({});
  }
}

export function writeDefaultConfigIfMissing(projectRoot: string): void {
  const file = path.join(officeRoot(projectRoot), "config.json");
  if (fs.existsSync(file)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const defaults: Config = configSchema.parse({});
  fs.writeFileSync(file, JSON.stringify(defaults, null, 2) + "\n", "utf8");
}
