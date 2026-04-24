import fs from "node:fs";
import path from "node:path";
import { execa } from "execa";
import { personaTemplateDir, officeRoot } from "./paths.js";
import { appendLog, appendSessionLog, writePersonaLog } from "./logger.js";
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

function log(ctx: PersonaContext, source: string, message: string): void {
  if (ctx.sessionDir) {
    appendSessionLog(ctx.sessionDir, source, message);
  }
  appendLog(ctx.projectRoot, source, message);
}

export async function spawnPersona(
  role: PersonaRole,
  ctx: PersonaContext,
  runner: Runner,
  config: Config,
): Promise<void> {
  const fullPrompt = buildPersonaPrompt(role, ctx);
  const bin = runnerBinary(runner);
  const model = config.models[role] ?? null;

  const promptsDir = path.join(officeRoot(ctx.projectRoot), "prompts");
  fs.mkdirSync(promptsDir, { recursive: true });
  const promptFile = path.join(promptsDir, `${role}-${Date.now()}.md`);
  fs.writeFileSync(promptFile, fullPrompt, "utf8");

  const shortPrompt =
    `Read the file at \`${promptFile}\` for your complete instructions.` +
    " Follow them exactly. Do NOT ask questions — act immediately.";
  const args = buildRunnerArgs(runner, shortPrompt, model);
  const fullCommand = `${bin} ${args.join(" ")}`;

  log(ctx, "orchestrator", `spawning ${role} | runner=${runner} | model=${model ?? "default"} | cmd: ${fullCommand}`);
  if (config.logging) {
    console.log(`\n[office] spawning ${role}: ${fullCommand}`);
    console.log(`[office] prompt file: ${promptFile}`);
    if (model) console.log(`[office] model: ${model}`);
  }

  const startTime = Date.now();
  let stdout = "";
  let stderr = "";

  try {
    const proc = execa(bin, args, {
      cwd: ctx.projectRoot,
      reject: false,
      timeout: config.timeouts.personaRunMs,
      env: {
        ...process.env,
        OFFICE_ROLE: role,
        ...(ctx.sessionDir ? { OFFICE_SESSION: ctx.sessionDir } : {}),
      },
    });

    proc.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    const res = await proc;
    const durationMs = Date.now() - startTime;

    const logFile = writePersonaLog(ctx.projectRoot, role, {
      command: fullCommand,
      exitCode: res.exitCode,
      timedOut: res.timedOut,
      stdout,
      stderr,
      durationMs,
      model,
      promptFile,
    });

    if (res.timedOut) {
      const msg = `${role} hit timeout (${config.timeouts.personaRunMs}ms) after ${durationMs}ms; killed`;
      log(ctx, "orchestrator", msg);
      console.error(`\n[office] ${msg}`);
      console.error(`[office] full output log: ${logFile}`);
    } else if (res.exitCode !== 0) {
      const msg = `${role} exited with code ${res.exitCode} after ${durationMs}ms | stdout=${stdout.length} bytes, stderr=${stderr.length} bytes`;
      log(ctx, "orchestrator", msg);
      console.error(`\n[office] ${msg}`);
      console.error(`[office] full output log: ${logFile}`);
    } else {
      const msg = `${role} finished successfully in ${durationMs}ms | stdout=${stdout.length} bytes`;
      log(ctx, "orchestrator", msg);
      if (config.logging) {
        console.log(`\n[office] ${msg}`);
        console.log(`[office] full output log: ${logFile}`);
      }
    }
  } finally {
    if (!config.logging) {
      try { fs.unlinkSync(promptFile); } catch {}
    }
  }
}
