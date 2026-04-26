import fs from "node:fs";
import path from "node:path";
import { personaTemplateDir } from "./paths.js";
import { callLlm, callLlmJson } from "./llm.js";
import { readCharacterState, writeCharacterState } from "./session-io.js";
import { appendTimeline, readRecentTimeline } from "./timeline.js";
import { characterStateSchema, stageManagerDiffResponseSchema, type CharacterState, type DiffEntry, type Session } from "./schema.js";
import type { Config } from "./config.js";

export type PersonaRole =
  | "space-creator"
  | "character-creator"
  | "stage-manager"
  | "character-agent";

function readTemplate(role: PersonaRole): string {
  return fs.readFileSync(path.join(personaTemplateDir(), `${role}.txt`), "utf8");
}

function readFileOrEmpty(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return "(not found)";
  }
}

export async function runSpaceCreator(
  description: string,
  outputPath: string,
  config: Config,
  projectRoot: string,
): Promise<void> {
  const systemPrompt = readTemplate("space-creator");
  const userPrompt = `Create a space: ${description}`;

  const response = await callLlm({
    config, role: "space-creator", systemPrompt, userPrompt, projectRoot,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, response.trim() + "\n", "utf8");
}

export async function runSpaceSummarizer(
  spaceText: string,
  outputPath: string,
  config: Config,
  projectRoot: string,
): Promise<void> {
  const systemPrompt = "You summarize virtual office space descriptions into a concise paragraph. Output a 2-4 sentence summary covering the key rooms, their connections, and the overall vibe. Plain text only.";
  const userPrompt = `Summarize this space:\n\n${spaceText}`;

  const response = await callLlm({
    config, role: "space-creator", systemPrompt, userPrompt, projectRoot,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, response.trim() + "\n", "utf8");
}

export async function runCharacterCreator(
  description: string,
  name: string,
  outputPath: string,
  existingCharacterSummaries: string[],
  config: Config,
  projectRoot: string,
): Promise<void> {
  const systemPrompt = readTemplate("character-creator");
  let userPrompt = `Create a character: ${description}\nName: ${name}`;

  if (existingCharacterSummaries.length > 0) {
    userPrompt += "\n\nExisting characters for reference:\n" + existingCharacterSummaries.join("\n");
  }

  const response = await callLlm({
    config, role: "character-creator", systemPrompt, userPrompt, projectRoot,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, response.trim() + "\n", "utf8");
}

export async function runCharacterAgent(
  characterName: string,
  sessionDir: string,
  session: Session,
  config: Config,
  projectRoot: string,
): Promise<string> {
  const systemPrompt = readTemplate("character-agent");

  const charDesc = readFileOrEmpty(path.join(sessionDir, `${characterName}.txt`));
  const charState = readCharacterState(sessionDir, characterName);
  const spaceDesc = readFileOrEmpty(path.join(sessionDir, `${session.spaceName}_summary.txt`));

  const stateText = [
    `LOCATION: ${charState.location}`,
    `CURRENT ACTION: ${charState.currentAction}`,
    `MOOD: ${charState.mood}`,
    `INTENT: ${charState.intent}`,
    `MEMORY: ${charState.memory.join(", ")}`,
    `RELATIONSHIPS: ${Object.entries(charState.relationships).map(([k, v]) => `${k}=${v}`).join(", ")}`,
  ].join("\n");

  const otherStates: string[] = [];
  for (const name of session.characters) {
    if (name !== characterName) {
      const state = readCharacterState(sessionDir, name);
      otherStates.push(`${name}: location=${state.location}, mood=${state.mood}, action=${state.currentAction}`);
    }
  }

  const userPrompt = [
    `You are: ${characterName}`,
    "",
    "YOUR CHARACTER DESCRIPTION:",
    charDesc,
    "",
    "YOUR CURRENT STATE:",
    stateText,
    "",
    "SPACE:",
    spaceDesc,
    "",
    "OTHER CHARACTERS IN SIMULATION:",
    otherStates.length > 0 ? otherStates.join("\n") : "(none)",
  ].join("\n");

  const response = await callLlm({
    config, role: "character-agent", systemPrompt, userPrompt, projectRoot, sessionDir,
  });

  const speechLine = response.trim().split("\n")[0].trim();
  appendTimeline(sessionDir, speechLine);
  return speechLine;
}

export async function runStageManager(
  sessionDir: string,
  session: Session,
  config: Config,
  projectRoot: string,
): Promise<void> {
  const systemPrompt = readTemplate("stage-manager");

  const spaceDesc = readFileOrEmpty(path.join(sessionDir, `${session.spaceName}.txt`));
  const timeline = readRecentTimeline(sessionDir, 10).join("\n");

  const characters: Record<string, unknown> = {};
  for (const name of session.characters) {
    characters[name] = readCharacterState(sessionDir, name);
  }

  const userPrompt = [
    "RECENT TIMELINE (last 10 entries):",
    timeline || "(empty)",
    "",
    "LOCATION DESCRIPTION:",
    spaceDesc,
    "",
    "CURRENT STATE (JSON):",
    JSON.stringify({ narration: "", characters }, null, 2),
  ].join("\n");

  const diffs = await callLlmJson({
    config, role: "stage-manager", systemPrompt, userPrompt, projectRoot, sessionDir,
    schema: stageManagerDiffResponseSchema,
  });

  const currentState: { narration: string; characters: Record<string, CharacterState> } = {
    narration: "",
    characters: {},
  };
  for (const name of session.characters) {
    currentState.characters[name] = readCharacterState(sessionDir, name);
  }

  applyDiffs(currentState, diffs);

  for (const name of session.characters) {
    const char = currentState.characters[name];
    if (char) {
      const updated = characterStateSchema.parse({ ...char, updatedAt: new Date().toISOString() });
      writeCharacterState(sessionDir, name, updated);
    }
  }

  if (currentState.narration?.trim()) {
    for (const line of currentState.narration.trim().split("\n")) {
      if (line.trim()) {
        appendTimeline(sessionDir, `[Stage Manager] ${line.trim()}`);
      }
    }
  }
}

function applyDiffs(
  state: { narration: string; characters: Record<string, CharacterState> },
  diffs: DiffEntry[],
): void {
  for (const diff of diffs) {
    const segments = diff.path.split(".");

    if (segments[0] === "narration") {
      if (diff.op === "set") {
        state.narration = String(diff.value ?? "");
      }
      continue;
    }

    if (segments[0] === "characters" && segments.length >= 3) {
      const charName = segments[1];
      const field = segments[2];
      const char = state.characters[charName];
      if (!char) continue;

      switch (field) {
        case "location":
        case "mood":
        case "currentAction":
        case "intent":
          if (diff.op === "set") {
            (char as Record<string, unknown>)[field] = String(diff.value ?? "");
          }
          break;

        case "memory":
          if (diff.op === "add") {
            char.memory.push(String(diff.value ?? ""));
            if (char.memory.length > 50) {
              char.memory = char.memory.slice(-50);
            }
          } else if (diff.op === "delete") {
            char.memory = char.memory.filter(m => m !== String(diff.value));
          }
          break;

        case "relationships":
          if (segments.length >= 4) {
            const targetName = segments[3];
            if (diff.op === "set") {
              char.relationships[targetName] = String(diff.value ?? "");
            } else if (diff.op === "delete") {
              delete char.relationships[targetName];
            }
          }
          break;
      }
    }
  }
}
