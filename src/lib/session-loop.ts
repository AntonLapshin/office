import readline from "node:readline";
import { readConfig } from "./config.js";
import { runCharacterAgent, runStageManager } from "./persona.js";
import { readSession, writeSession } from "./session-io.js";
import { appendTimeline, readRecentTimeline } from "./timeline.js";

export interface SessionLoopOptions {
  projectRoot?: string;
}

export async function runSessionLoop(
  sessionDir: string,
  opts: SessionLoopOptions = {},
): Promise<void> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const config = readConfig(projectRoot);

  setupGracefulShutdown(sessionDir);

  let session = readSession(sessionDir);

  while (session.status === "active") {
    if (session.turnPhase === "character-turn") {
      if (session.currentTurnIndex === 0) {
        console.log(`\n--- Round ${session.currentRound + 1} ---\n`);
        printRecentTimeline(sessionDir, 5);
      }

      const characterName = session.characters[session.currentTurnIndex];

      if (characterName === session.userCharacter) {
        printRecentTimeline(sessionDir, 10);
        const userInput = await promptUser(characterName);

        if (userInput === null) {
          session.status = "paused";
          writeSession(sessionDir, session);
          console.log(`\nSession paused. Resume with: office session continue ${session.id}`);
          return;
        }

        if (userInput.trim().length > 0) {
          const { target, message } = parseUserInput(userInput);
          appendTimeline(sessionDir, `${characterName} => ${target}: ${message}`);
        }
      } else {
        console.log(`\n[${characterName}'s turn]`);
        await runCharacterAgent(characterName, sessionDir, session, config, projectRoot);
        printRecentTimeline(sessionDir, 3);
      }

      session.turnPhase = "stage-manager-update";
      writeSession(sessionDir, session);
    }

    if (session.turnPhase === "stage-manager-update") {
      await runStageManager(sessionDir, session, config, projectRoot);
      printRecentTimeline(sessionDir, 3);

      const nextIndex = session.currentTurnIndex + 1;
      if (nextIndex >= session.characters.length) {
        session.currentRound++;
        session.currentTurnIndex = 0;
        session.turnPhase = "character-turn";
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
      console.log(`\nSession paused. Resume with: office session continue ${session.id}`);
    } catch {
      // best effort
    }
    process.exit(0);
  };

  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
}
