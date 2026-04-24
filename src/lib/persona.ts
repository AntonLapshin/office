import fs from "node:fs";
import path from "node:path";
import { execa } from "execa";
import { personaTemplateDir } from "./paths.js";
import { appendLog } from "./logger.js";
import { buildRunnerArgs, runnerBinary, type Runner } from "./runner.js";
import type { Config } from "./config.js";

export type PersonaRole =
  | "space-creator"
  | "character-creator"
  | "stage-manager"
  | "character-agent";

export interface PersonaContext {
  sessionDir?: string;
  projectRoot: string;
  extraContext?: Record<string, string>;
}

export function buildPersonaPrompt(role: PersonaRole, ctx: PersonaContext): string {
  const template = fs.readFileSync(
    path.join(personaTemplateDir(), `${role}.md`),
    "utf8",
  );

  const lines = [template.trim(), "", "## Session context"];
  lines.push(`- Project root: \`${ctx.projectRoot}\``);

  if (ctx.sessionDir) {
    lines.push(`- Session directory: \`${ctx.sessionDir}\``);
  }

  if (ctx.extraContext) {
    for (const [key, value] of Object.entries(ctx.extraContext)) {
      lines.push(`- ${key}: \`${value}\``);
    }
  }

  return lines.join("\n");
}

export async function spawnPersona(
  role: PersonaRole,
  ctx: PersonaContext,
  runner: Runner,
  config: Config,
): Promise<void> {
  const prompt = buildPersonaPrompt(role, ctx);
  const bin = runnerBinary(runner);
  const args = buildRunnerArgs(runner, prompt);

  const logDir = ctx.sessionDir ?? ctx.projectRoot;
  appendLog(logDir, "orchestrator", `spawning ${role}`);

  const res = await execa(bin, args, {
    cwd: ctx.projectRoot,
    stdio: ["ignore", "inherit", "inherit"],
    reject: false,
    timeout: config.timeouts.personaRunMs,
    env: {
      ...process.env,
      OFFICE_ROLE: role,
      ...(ctx.sessionDir ? { OFFICE_SESSION: ctx.sessionDir } : {}),
    },
  });

  if (res.timedOut) {
    appendLog(logDir, "orchestrator", `${role} hit timeout (${config.timeouts.personaRunMs}ms); killed`);
  } else if (res.exitCode !== 0) {
    appendLog(logDir, "orchestrator", `${role} exited ${res.exitCode}`);
  }
}
