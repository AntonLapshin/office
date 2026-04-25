import fs from "node:fs";
import path from "node:path";
import { personaTemplateDir } from "./paths.js";
import { callLlm, callLlmJson } from "./llm.js";
import { readCharacterState, writeCharacterState } from "./session-io.js";
import { appendTimeline, readRecentTimeline } from "./timeline.js";
import { characterStateSchema, stageManagerResponseSchema, type Session } from "./schema.js";
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
  const charState = readFileOrEmpty(path.join(sessionDir, `${characterName}.json`));
  const spaceDesc = readFileOrEmpty(path.join(sessionDir, `${session.spaceName}.txt`));
  const timeline = readRecentTimeline(sessionDir, 50).join("\n");

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
    charState,
    "",
    "SPACE:",
    spaceDesc,
    "",
    "OTHER CHARACTERS IN SIMULATION:",
    otherStates.length > 0 ? otherStates.join("\n") : "(none)",
    "",
    "RECENT TIMELINE:",
    timeline || "(empty)",
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
  const timeline = readRecentTimeline(sessionDir, 50).join("\n");

  const characters: Record<string, unknown> = {};
  for (const name of session.characters) {
    characters[name] = readCharacterState(sessionDir, name);
  }

  const inputJson = { space: spaceDesc, characters, timeline };
  const userPrompt = JSON.stringify(inputJson, null, 2);

  const result = await callLlmJson({
    config, role: "stage-manager", systemPrompt, userPrompt, projectRoot, sessionDir,
    schema: stageManagerResponseSchema,
  });

  for (const name of session.characters) {
    const raw = result.characters[name];
    if (raw) {
      const updated = characterStateSchema.parse({ ...raw, updatedAt: new Date().toISOString() });
      writeCharacterState(sessionDir, name, updated);
    }
  }

  if (result.narration && result.narration.trim().length > 0) {
    for (const line of result.narration.trim().split("\n")) {
      if (line.trim()) {
        appendTimeline(sessionDir, `[Stage Manager] ${line.trim()}`);
      }
    }
  }
}
