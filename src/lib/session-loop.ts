import path from "node:path";
import readline from "node:readline";
import { readConfig, type Config } from "./config.js";
import { detectRunner, type Runner } from "./runner.js";
import { spawnPersona } from "./persona.js";
import { readSession, writeSession } from "./session-io.js";
import { appendTimeline, readRecentTimeline } from "./timeline.js";
import type { Session } from "./schema.js";

export interface SessionLoopOptions {
  runner?: string;
  projectRoot?: string;
}

export async function runSessionLoop(
  sessionDir: string,
  opts: SessionLoopOptions = {},
): Promise<void> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const config = readConfig(projectRoot);
  const runner = await detectRunner(opts.runner ?? config.runner ?? undefined);

  setupGracefulShutdown(sessionDir);

  let session = readSession(sessionDir);

  while (session.status === "active") {
    if (session.turnPhase === "stage-manager-init") {
      console.log(`\n--- Round ${session.currentRound + 1} ---\n`);

      await spawnStageManager(sessionDir, projectRoot, runner, config, session, "init");
      printRecentTimeline(sessionDir, 5);

      session.turnPhase = "character-turn";
      session.currentTurnIndex = 0;
      writeSession(sessionDir, session);
    }

    if (session.turnPhase === "character-turn") {
      const characterName = session.characters[session.currentTurnIndex];

      if (characterName === session.userCharacter) {
        printRecentTimeline(sessionDir, 10);
        const userInput = await promptUser(characterName);

        if (userInput === null) {
          session.status = "paused";
          writeSession(sessionDir, session);
          console.log(`\nSession paused. Resume with: office continue ${session.id}`);
          return;
        }

        if (userInput.trim().length > 0) {
          const { target, message } = parseUserInput(userInput);
          appendTimeline(sessionDir, `${characterName} => ${target}: ${message}`);
        }
      } else {
        console.log(`\n[${characterName}'s turn]`);
        await spawnCharacterAgent(sessionDir, projectRoot, runner, config, session, characterName);
        printRecentTimeline(sessionDir, 3);
      }

      session.turnPhase = "stage-manager-update";
      writeSession(sessionDir, session);
    }

    if (session.turnPhase === "stage-manager-update") {
      await spawnStageManager(sessionDir, projectRoot, runner, config, session, "update");
      printRecentTimeline(sessionDir, 3);

      const nextIndex = session.currentTurnIndex + 1;
      if (nextIndex >= session.characters.length) {
        session.currentRound++;
        session.currentTurnIndex = 0;
        session.turnPhase = "stage-manager-init";
      } else {
        session.currentTurnIndex = nextIndex;
        session.turnPhase = "character-turn";
      }
      writeSession(sessionDir, session);
    }

    if (session.currentRound >= config.maxRounds) {
      console.log(`\nReached maximum rounds (${config.maxRounds}). Session paused.`);
      session.status = "paused";
      writeSession(sessionDir, session);
      return;
    }

    session = readSession(sessionDir);
  }
}

async function spawnStageManager(
  sessionDir: string,
  projectRoot: string,
  runner: Runner,
  config: Config,
  session: Session,
  mode: "init" | "update",
): Promise<void> {
  const characterStates = session.characters
    .map((name) => path.join(sessionDir, `${name}.json`))
    .join(", ");

  await spawnPersona(
    "stage-manager",
    {
      projectRoot,
      sessionDir,
      extraContext: {
        "Mode": mode,
        "Space file": path.join(sessionDir, `${session.spaceName}.md`),
        "Character states": characterStates,
        "Timeline": path.join(sessionDir, "timeline.log"),
        "Current round": String(session.currentRound),
      },
    },
    runner,
    config,
  );
}

async function spawnCharacterAgent(
  sessionDir: string,
  projectRoot: string,
  runner: Runner,
  config: Config,
  session: Session,
  characterName: string,
): Promise<void> {
  const allStates = session.characters
    .map((name) => path.join(sessionDir, `${name}.json`))
    .join(", ");

  await spawnPersona(
    "character-agent",
    {
      projectRoot,
      sessionDir,
      extraContext: {
        "Character name": characterName,
        "Character description": path.join(sessionDir, `${characterName}.md`),
        "Character state": path.join(sessionDir, `${characterName}.json`),
        "Space file": path.join(sessionDir, `${session.spaceName}.md`),
        "All character states": allStates,
        "Timeline": path.join(sessionDir, "timeline.log"),
      },
    },
    runner,
    config,
  );
}

function printRecentTimeline(sessionDir: string, count: number): void {
  const lines = readRecentTimeline(sessionDir, count);
  if (lines.length === 0) return;
  console.log("");
  for (const line of lines) {
    console.log(`  ${line}`);
  }
  console.log("");
}

async function promptUser(characterName: string): Promise<string | null> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    let answered = false;

    rl.question(`[You as ${characterName}] > `, (answer) => {
      answered = true;
      rl.close();
      if (answer.trim().toLowerCase() === "/quit") {
        resolve(null);
      } else {
        resolve(answer);
      }
    });

    rl.on("close", () => {
      if (!answered) {
        resolve(null);
      }
    });
  });
}

function parseUserInput(input: string): { target: string; message: string } {
  const colonIndex = input.indexOf(":");
  if (colonIndex > 0) {
    const potentialTarget = input.slice(0, colonIndex).trim();
    if (/^[A-Za-z]+$/.test(potentialTarget)) {
      return {
        target: potentialTarget,
        message: input.slice(colonIndex + 1).trim(),
      };
    }
  }
  return { target: "everyone", message: input.trim() };
}

function setupGracefulShutdown(sessionDir: string): void {
  const handler = () => {
    try {
      const session = readSession(sessionDir);
      session.status = "paused";
      writeSession(sessionDir, session);
      console.log(`\nSession paused. Resume with: office continue ${session.id}`);
    } catch {
      // best effort
    }
    process.exit(0);
  };

  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
}
