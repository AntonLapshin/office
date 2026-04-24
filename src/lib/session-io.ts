import fs from "node:fs";
import path from "node:path";
import {
  sessionSchema,
  characterStateSchema,
  type Session,
  type CharacterState,
} from "./schema.js";

export function readSession(sessionDir: string): Session {
  const file = path.join(sessionDir, "session.json");
  return sessionSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
}

export function writeSession(sessionDir: string, session: Session): void {
  session.updatedAt = new Date().toISOString();
  const validated = sessionSchema.parse(session);
  const file = path.join(sessionDir, "session.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(validated, null, 2) + "\n", "utf8");
}

export function sessionExists(sessionDir: string): boolean {
  return fs.existsSync(path.join(sessionDir, "session.json"));
}

export function readCharacterState(sessionDir: string, name: string): CharacterState {
  const file = path.join(sessionDir, `${name}.json`);
  return characterStateSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
}

export function writeCharacterState(sessionDir: string, name: string, state: CharacterState): void {
  state.updatedAt = new Date().toISOString();
  const validated = characterStateSchema.parse(state);
  const file = path.join(sessionDir, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(validated, null, 2) + "\n", "utf8");
}
