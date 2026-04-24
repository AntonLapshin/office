import fs from "node:fs";
import path from "node:path";

export function appendLog(dir: string, source: string, message: string): void {
  const ts = new Date().toISOString();
  const flat = message.replace(/\n/g, " ").trim();
  const line = `${ts} | ${source.toUpperCase()} | ${flat}\n`;
  fs.appendFileSync(path.join(dir, "logs.txt"), line, "utf8");
}
