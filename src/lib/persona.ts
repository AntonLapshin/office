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
  embeddedFiles?: Record<string, string>;
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

  if (ctx.embeddedFiles && Object.keys(ctx.embeddedFiles).length > 0) {
    lines.push("", "## Pre-loaded context", "");
    lines.push(
      "All files below are pre-loaded. Use this content directly — do **not** re-read these files from disk. When you need to write back to a file, use the path from Session context above.",
    );
    lines.push("");
    for (const [label, filePath] of Object.entries(ctx.embeddedFiles)) {
      const ext = path.extname(filePath).slice(1) || "text";
      try {
        const content = fs.readFileSync(filePath, "utf8");
        lines.push(`### ${label}`);
        lines.push("```" + ext);
        lines.push(content.trimEnd() || "(empty)");
        lines.push("```");
        lines.push("");
      } catch {
        lines.push(`### ${label}`);
        lines.push("(file not found)");
        lines.push("");
      }
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
  const fullPrompt = buildPersonaPrompt(role, ctx);
  const bin = runnerBinary(runner);

  // Write the full prompt to a temp file to avoid OS command-line length
  // limits and argument-quoting issues (especially on Windows).
  const officeDir = path.join(ctx.projectRoot, ".office");
  fs.mkdirSync(officeDir, { recursive: true });
  const promptFile = path.join(officeDir, `.prompt-${role}-${Date.now()}.md`);
  fs.writeFileSync(promptFile, fullPrompt, "utf8");

  const shortPrompt =
    `Read the file at \`${promptFile}\` for your complete instructions.` +
    " Follow them exactly. Do NOT ask questions — act immediately.";
  const args = buildRunnerArgs(runner, shortPrompt);

  const logDir = ctx.sessionDir ?? ctx.projectRoot;
  const log = config.logging;

  appendLog(logDir, "orchestrator", `spawning ${role}`);
  if (log) {
    console.log(`\n[office] spawning ${role}: ${bin} ${args.join(" ")}`);
    console.log(`[office] prompt file: ${promptFile}`);
  }

  try {
    const res = await execa(bin, args, {
      cwd: ctx.projectRoot,
      stdio: "inherit",
      reject: false,
      timeout: config.timeouts.personaRunMs,
      env: {
        ...process.env,
        OFFICE_ROLE: role,
        ...(ctx.sessionDir ? { OFFICE_SESSION: ctx.sessionDir } : {}),
      },
    });

    if (res.timedOut) {
      const msg = `${role} hit timeout (${config.timeouts.personaRunMs}ms); killed`;
      appendLog(logDir, "orchestrator", msg);
      console.error(`\n[office] ${msg}`);
    } else if (res.exitCode !== 0) {
      const msg = `${role} exited with code ${res.exitCode}`;
      appendLog(logDir, "orchestrator", msg);
      console.error(`\n[office] ${msg}`);
      if (res.stderr) {
        console.error(res.stderr);
      }
    } else if (log) {
      console.log(`[office] ${role} finished successfully`);
    }
  } finally {
    if (!log) {
      try { fs.unlinkSync(promptFile); } catch {}
    }
  }
}
