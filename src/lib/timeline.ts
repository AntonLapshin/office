import fs from "node:fs";
import path from "node:path";

export function appendTimeline(sessionDir: string, line: string): void {
  const file = path.join(sessionDir, "timeline.log");
  fs.appendFileSync(file, line + "\n", "utf8");
}

export function readRecentTimeline(sessionDir: string, count: number): string[] {
  const file = path.join(sessionDir, "timeline.log");
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
  return lines.slice(-count);
}
