import fs from "node:fs";
import path from "node:path";
import { spacesDir, charactersDir, sessionsDir, sessionDirName, capitalize } from "../lib/paths.js";
import { writeSession } from "../lib/session-io.js";
import { writeCharacterState } from "../lib/session-io.js";
import { runSessionLoop } from "../lib/session-loop.js";
import type { Session, CharacterState } from "../lib/schema.js";

export interface StartOptions {
  space: string;
  characters: string;
  description?: string;
  user?: string;
  runner?: string;
  projectRoot?: string;
}

export async function runStart(opts: StartOptions): Promise<void> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const spaceName = opts.space.trim().toLowerCase();
  const characterNames = opts.characters.split(",").map((s) => capitalize(s.trim().toLowerCase()));
  const description = opts.description ?? "Office simulation";
  const userCharacter = opts.user ? capitalize(opts.user.trim().toLowerCase()) : null;

  const spaceFile = path.join(spacesDir(projectRoot), `${spaceName}.md`);
  if (!fs.existsSync(spaceFile)) {
    console.error(`Space not found: ${spaceFile}`);
    console.error(`Available spaces: ${listFiles(spacesDir(projectRoot))}`);
    process.exit(1);
  }

  for (const name of characterNames) {
    const charFile = path.join(charactersDir(projectRoot), `${name}.md`);
    if (!fs.existsSync(charFile)) {
      console.error(`Character not found: ${charFile}`);
      console.error(`Available characters: ${listFiles(charactersDir(projectRoot))}`);
      process.exit(1);
    }
  }

  if (userCharacter && !characterNames.includes(userCharacter)) {
    console.error(`User character "${userCharacter}" is not in the characters list: ${characterNames.join(", ")}`);
    process.exit(1);
  }

  const sessionId = sessionDirName(description);
  const sessionDir = path.join(sessionsDir(projectRoot), sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });

  fs.copyFileSync(spaceFile, path.join(sessionDir, `${spaceName}.md`));

  for (const name of characterNames) {
    const src = path.join(charactersDir(projectRoot), `${name}.md`);
    fs.copyFileSync(src, path.join(sessionDir, `${name}.md`));
  }

  const firstRoom = extractFirstRoom(spaceFile);

  for (const name of characterNames) {
    const relationships: Record<string, string> = {};
    for (const other of characterNames) {
      if (other !== name) {
        relationships[other] = "stranger";
      }
    }

    const state: CharacterState = {
      name,
      location: firstRoom,
      mood: "neutral",
      currentAction: "standing",
      intents: [],
      memory: [],
      relationships,
      updatedAt: new Date().toISOString(),
    };
    writeCharacterState(sessionDir, name, state);
  }

  fs.writeFileSync(path.join(sessionDir, "timeline.log"), "", "utf8");

  const session: Session = {
    id: sessionId,
    description,
    spaceName,
    characters: characterNames,
    userCharacter,
    status: "active",
    currentRound: 0,
    currentTurnIndex: 0,
    turnPhase: "stage-manager-init",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeSession(sessionDir, session);

  console.log(`Session created: ${sessionDir}`);
  console.log(`Space: ${spaceName}`);
  console.log(`Characters: ${characterNames.join(", ")}`);
  if (userCharacter) {
    console.log(`You are: ${userCharacter}`);
  }
  console.log("");

  await runSessionLoop(sessionDir, {
    runner: opts.runner,
    projectRoot,
  });
}

function extractFirstRoom(spaceFile: string): string {
  const content = fs.readFileSync(spaceFile, "utf8");
  const match = content.match(/^###\s+(.+)$/m);
  if (match) return match[1].trim();
  return "main room";
}

function listFiles(dir: string): string {
  if (!fs.existsSync(dir)) return "(none)";
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  if (files.length === 0) return "(none)";
  return files.map((f) => f.replace(".md", "")).join(", ");
}
