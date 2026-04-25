import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { officeRoot } from "./paths.js";

const modelsSchema = z.object({
  "stage-manager": z.string().nullable().default(null),
  "character-agent": z.string().nullable().default(null),
  "character-creator": z.string().nullable().default(null),
  "space-creator": z.string().nullable().default(null),
}).default({});

const configSchema = z.object({
  provider: z.object({
    baseUrl: z.string().default("http://localhost:11434"),
  }).default({}),
  defaultModel: z.string().default("llama3.2"),
  models: modelsSchema,
  logging: z.boolean().default(true),
  maxRounds: z.number().int().default(50),
  retries: z.number().int().default(3),
  delayMs: z.number().int().default(0),
  timeoutMs: z.number().int().default(300_000),
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
