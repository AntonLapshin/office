import fs from "node:fs";
import path from "node:path";
import { spacesDir, charactersDir, sessionsDir, sessionDirName, capitalize } from "../lib/paths.js";
import { writeSession, writeCharacterState } from "../lib/session-io.js";
import { appendTimeline } from "../lib/timeline.js";
import { runSessionLoop } from "../lib/session-loop.js";
import type { Session, CharacterState } from "../lib/schema.js";

export interface StartOptions {
  space: string;
  characters: string;
  description?: string;
  user?: string;
  projectRoot?: string;
}

export async function runStart(opts: StartOptions): Promise<void> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const spaceName = opts.space.trim().toLowerCase();
  const characterNames = opts.characters.split(",").map((s) => capitalize(s.trim().toLowerCase()));
  const description = opts.description ?? "Office simulation";
  const userCharacter = opts.user ? capitalize(opts.user.trim().toLowerCase()) : null;

  const spaceFile = path.join(spacesDir(projectRoot), `${spaceName}.txt`);
  if (!fs.existsSync(spaceFile)) {
    console.error(`Space not found: ${spaceFile}`);
    console.error(`Available spaces: ${listFiles(spacesDir(projectRoot))}`);
    process.exit(1);
  }

  for (const name of characterNames) {
    const charFile = path.join(charactersDir(projectRoot), `${name}.txt`);
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

  const sessionId = sessionDirName(projectRoot);
  const sessionDir = path.join(sessionsDir(projectRoot), sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });

  const sessionSpacesDir = path.join(sessionDir, "spaces");
  const sessionCharsDir = path.join(sessionDir, "characters");
  fs.mkdirSync(sessionSpacesDir, { recursive: true });
  fs.mkdirSync(sessionCharsDir, { recursive: true });

  fs.copyFileSync(spaceFile, path.join(sessionSpacesDir, `${spaceName}.txt`));

  const summaryFile = path.join(spacesDir(projectRoot), `${spaceName}_summary.txt`);
  if (fs.existsSync(summaryFile)) {
    fs.copyFileSync(summaryFile, path.join(sessionSpacesDir, `${spaceName}_summary.txt`));
  }

  for (const name of characterNames) {
    const src = path.join(charactersDir(projectRoot), `${name}.txt`);
    fs.copyFileSync(src, path.join(sessionCharsDir, `${name}.txt`));
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
      intent: "",
      memory: [],
      relationships,
      updatedAt: new Date().toISOString(),
    };
    writeCharacterState(sessionDir, name, state);
  }

  fs.writeFileSync(path.join(sessionDir, "timeline.log"), "", "utf8");
  appendTimeline(sessionDir, `[Stage Manager] ${description}`);

  const session: Session = {
    id: sessionId,
    description,
    spaceName,
    characters: characterNames,
    userCharacter,
    status: "active",
    currentRound: 0,
    currentTurnIndex: 0,
    turnPhase: "character-turn",
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

  await runSessionLoop(sessionDir, { projectRoot });
}

function extractFirstRoom(spaceFile: string): string {
  const content = fs.readFileSync(spaceFile, "utf8");
  // Plain text format: look for room names under ROOMS section
  // Rooms are listed as "- Name" lines or as standalone capitalized lines
  const roomsMatch = content.match(/^ROOMS\s*\n([\s\S]*?)(?=^[A-Z]{2,}|\Z)/m);
  if (roomsMatch) {
    const roomLine = roomsMatch[1].match(/^\s*-\s*(.+)/m);
    if (roomLine) return roomLine[1].trim();
    const namedLine = roomsMatch[1].match(/^\s*(\w[\w\s]+\w)\s*$/m);
    if (namedLine) return namedLine[1].trim();
  }
  // Fallback: look for markdown heading (backward compat)
  const mdMatch = content.match(/^###\s+(.+)$/m);
  if (mdMatch) return mdMatch[1].trim();
  return "main room";
}

function listFiles(dir: string): string {
  if (!fs.existsSync(dir)) return "(none)";
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".txt"));
  if (files.length === 0) return "(none)";
  return files.map((f) => f.replace(".txt", "")).join(", ");
}
