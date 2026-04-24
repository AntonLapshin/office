import fs from "node:fs";
import path from "node:path";
import { officeRoot } from "./paths.js";

export function logsDir(projectRoot: string): string {
  return path.join(officeRoot(projectRoot), "logs");
}

export function appendLog(projectRoot: string, source: string, message: string): void {
  const ts = new Date().toISOString();
  const flat = message.replace(/\n/g, " ").trim();
  const line = `${ts} | ${source.toUpperCase()} | ${flat}\n`;
  const logFile = path.join(officeRoot(projectRoot), "logs.txt");
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.appendFileSync(logFile, line, "utf8");
}

export function appendSessionLog(sessionDir: string, source: string, message: string): void {
  const ts = new Date().toISOString();
  const flat = message.replace(/\n/g, " ").trim();
  const line = `${ts} | ${source.toUpperCase()} | ${flat}\n`;
  fs.appendFileSync(path.join(sessionDir, "logs.txt"), line, "utf8");
}

export function appendPerf(
  projectRoot: string,
  entry: {
    role: string;
    model: string | null;
    runner: string;
    durationMs: number;
    status: "success" | "error" | "timeout";
  },
): void {
  const ts = new Date().toISOString();
  const model = entry.model ?? "default";
  const secs = (entry.durationMs / 1000).toFixed(1);
  const line = `${ts} | ${entry.role.padEnd(24)} | ${entry.runner.padEnd(8)} | model=${model.padEnd(30)} | ${secs}s | ${entry.status}\n`;
  const perfFile = path.join(officeRoot(projectRoot), "performance.txt");
  fs.mkdirSync(path.dirname(perfFile), { recursive: true });
  fs.appendFileSync(perfFile, line, "utf8");
}

export function writePersonaLog(
  projectRoot: string,
  role: string,
  data: {
    command: string;
    exitCode: number | undefined;
    timedOut: boolean;
    stdout: string;
    stderr: string;
    durationMs: number;
    model?: string | null;
    promptFile?: string;
  },
): string {
  const dir = logsDir(projectRoot);
  fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const logFile = path.join(dir, `${role}-${ts}.log`);

  const lines = [
    `=== Persona Run: ${role} ===`,
    `Timestamp: ${new Date().toISOString()}`,
    `Command: ${data.command}`,
    `Model: ${data.model ?? "default"}`,
    `Exit code: ${data.exitCode ?? "unknown"}`,
    `Timed out: ${data.timedOut}`,
    `Duration: ${data.durationMs}ms`,
    "",
  ];

  if (data.promptFile) {
    lines.push(`Prompt file: ${data.promptFile}`);
    try {
      const prompt = fs.readFileSync(data.promptFile, "utf8");
      lines.push("--- Prompt content ---", prompt, "--- End prompt ---", "");
    } catch {
      lines.push("(prompt file not found — already cleaned up)", "");
    }
  }

  if (data.stdout) {
    lines.push("--- STDOUT ---", data.stdout, "--- End STDOUT ---", "");
  } else {
    lines.push("--- STDOUT --- (empty)", "");
  }

  if (data.stderr) {
    lines.push("--- STDERR ---", data.stderr, "--- End STDERR ---", "");
  }

  fs.writeFileSync(logFile, lines.join("\n"), "utf8");
  return logFile;
}
