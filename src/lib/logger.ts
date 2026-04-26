import fs from "node:fs";
import path from "node:path";
import { officeRoot } from "./paths.js";

export function appendLog(projectRoot: string, source: string, message: string, sessionDir?: string): void {
  const ts = new Date().toISOString();
  const flat = message.replace(/\n/g, " ").trim();
  const line = `${ts} | ${source.toUpperCase()} | ${flat}\n`;

  if (sessionDir) {
    const dir = path.join(sessionDir, "logs");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, "logs.txt"), line, "utf8");
  } else {
    const logFile = path.join(officeRoot(projectRoot), "logs.txt");
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, line, "utf8");
  }
}

export function appendPerf(
  projectRoot: string,
  entry: {
    role: string;
    model: string;
    durationMs: number;
    status: "success" | "error" | "timeout";
    attempt: number;
    error?: string;
  },
  sessionDir?: string,
): void {
  const ts = new Date().toISOString();
  const secs = (entry.durationMs / 1000).toFixed(1);
  let line = `${ts} | ${entry.role.padEnd(24)} | model=${entry.model.padEnd(20)} | ${secs}s | attempt ${entry.attempt} | ${entry.status}`;
  if (entry.error) {
    line += ` | ${entry.error}`;
  }
  line += "\n";

  if (sessionDir) {
    const dir = path.join(sessionDir, "logs");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, "performance.txt"), line, "utf8");
  } else {
    const perfFile = path.join(officeRoot(projectRoot), "performance.txt");
    fs.mkdirSync(path.dirname(perfFile), { recursive: true });
    fs.appendFileSync(perfFile, line, "utf8");
  }
}

export function appendLlmLog(
  projectRoot: string,
  data: {
    role: string;
    model: string;
    durationMs: number;
    status: "success" | "error";
    attempt: number;
    systemPrompt: string;
    userPrompt: string;
    response: string;
    error?: string;
  },
  sessionDir?: string,
): void {
  const dir = sessionDir ? path.join(sessionDir, "logs") : path.join(officeRoot(projectRoot), "logs");
  fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const logFile = path.join(dir, `${data.role}-${ts}.log`);

  const lines = [
    `=== LLM Call: ${data.role} ===`,
    `Timestamp: ${new Date().toISOString()}`,
    `Model: ${data.model}`,
    `Duration: ${data.durationMs}ms`,
    `Status: ${data.status}`,
    `Attempt: ${data.attempt}`,
  ];

  if (data.error) {
    lines.push(`Error: ${data.error}`);
  }

  lines.push(
    "",
    "--- System Prompt ---",
    data.systemPrompt,
    "--- End System Prompt ---",
    "",
    "--- User Prompt ---",
    data.userPrompt,
    "--- End User Prompt ---",
    "",
    "--- Response ---",
    data.response || "(empty)",
    "--- End Response ---",
  );

  fs.writeFileSync(logFile, lines.join("\n"), "utf8");
}
