import fs from "node:fs";
import path from "node:path";
import { charactersDir, sessionsDir, capitalize } from "../lib/paths.js";
import { readSession, writeSession, readCharacterState, writeCharacterState } from "../lib/session-io.js";
import type { CharacterState } from "../lib/schema.js";

export interface AddCharacterOptions {
  projectRoot?: string;
}

export async function runAddCharacter(
  sessionName: string,
  characterName: string,
  opts: AddCharacterOptions = {},
): Promise<void> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const name = capitalize(characterName.trim().toLowerCase());
  const sessionDir = path.join(sessionsDir(projectRoot), sessionName);

  if (!fs.existsSync(path.join(sessionDir, "session.json"))) {
    console.error(`Session not found: ${sessionName}`);
    process.exit(1);
  }

  const charFile = path.join(charactersDir(projectRoot), `${name}.txt`);
  if (!fs.existsSync(charFile)) {
    console.error(`Character not found: ${charFile}`);
    process.exit(1);
  }

  const session = readSession(sessionDir);

  if (session.characters.includes(name)) {
    console.error(`Character "${name}" is already in this session.`);
    process.exit(1);
  }

  const charsDir = path.join(sessionDir, "characters");
  fs.mkdirSync(charsDir, { recursive: true });
  fs.copyFileSync(charFile, path.join(charsDir, `${name}.txt`));

  let location = "main room";
  if (session.characters.length > 0) {
    const existing = readCharacterState(sessionDir, session.characters[0]);
    location = existing.location;
  }

  const relationships: Record<string, string> = {};
  for (const other of session.characters) {
    relationships[other] = "stranger";
  }

  const state: CharacterState = {
    name,
    location,
    mood: "neutral",
    currentAction: "standing",
    intent: "",
    memory: [],
    relationships,
    updatedAt: new Date().toISOString(),
  };
  writeCharacterState(sessionDir, name, state);

  for (const other of session.characters) {
    const otherState = readCharacterState(sessionDir, other);
    otherState.relationships[name] = "stranger";
    writeCharacterState(sessionDir, other, otherState);
  }

  session.characters.push(name);
  writeSession(sessionDir, session);

  console.log(`Added "${name}" to session ${sessionName}`);
  console.log(`Location: ${location}`);
  console.log(`Characters: ${session.characters.join(", ")}`);
}
