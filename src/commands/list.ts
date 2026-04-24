import fs from "node:fs";
import path from "node:path";
import { spacesDir, charactersDir, sessionsDir } from "../lib/paths.js";
import { readSession } from "../lib/session-io.js";

export type ListTarget = "spaces" | "characters" | "sessions";

export function runList(target: ListTarget, projectRoot: string): void {
  switch (target) {
    case "spaces":
      listMarkdownFiles(spacesDir(projectRoot), "spaces");
      break;
    case "characters":
      listMarkdownFiles(charactersDir(projectRoot), "characters");
      break;
    case "sessions":
      listSessions(projectRoot);
      break;
  }
}

function listMarkdownFiles(dir: string, label: string): void {
  if (!fs.existsSync(dir)) {
    console.log(`No ${label} found.`);
    return;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  if (files.length === 0) {
    console.log(`No ${label} found.`);
    return;
  }
  for (const file of files) {
    console.log(`  ${file.replace(".md", "")}`);
  }
}

function listSessions(projectRoot: string): void {
  const dir = sessionsDir(projectRoot);
  if (!fs.existsSync(dir)) {
    console.log("No sessions found.");
    return;
  }
  const entries = fs.readdirSync(dir).filter((name) => {
    return fs.existsSync(path.join(dir, name, "session.json"));
  });
  if (entries.length === 0) {
    console.log("No sessions found.");
    return;
  }
  for (const name of entries) {
    try {
      const session = readSession(path.join(dir, name));
      const chars = session.characters.join(", ");
      console.log(`  ${session.id}  [${session.status}]  ${session.spaceName}  (${chars})`);
    } catch {
      console.log(`  ${name}  [error reading session]`);
    }
  }
}
