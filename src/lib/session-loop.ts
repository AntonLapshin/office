import readline from "node:readline";
import { readConfig } from "./config.js";
import { runCharacterAgent, runStageManager } from "./persona.js";
import { readSession, writeSession, readCharacterState } from "./session-io.js";
import { appendTimeline, readRecentTimeline } from "./timeline.js";
import { SessionServer } from "./server.js";

export interface SessionLoopOptions {
  projectRoot?: string;
  port?: number;
}

export async function runSessionLoop(
  sessionDir: string,
  opts: SessionLoopOptions = {},
): Promise<void> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const config = readConfig(projectRoot);

  let server: SessionServer | undefined;
  if (opts.port) {
    server = new SessionServer(sessionDir, opts.port);
    await server.start();
  }

  setupGracefulShutdown(sessionDir, server);

  let session = readSession(sessionDir);

  while (session.status === "active") {
    if (session.turnPhase === "character-turn") {
      if (session.currentTurnIndex === 0) {
        console.log(`\n--- Round ${session.currentRound + 1} ---\n`);
        printRecentTimeline(sessionDir, 5);
        server?.emit("round", { round: session.currentRound + 1 });
      }

      const characterName = session.characters[session.currentTurnIndex];

      if (characterName === session.userCharacter) {
        let userInput: string | null;
        if (server) {
          userInput = await server.waitForMessage(characterName);
        } else {
          printRecentTimeline(sessionDir, 10);
          userInput = await promptUser(characterName);
        }

        if (userInput === null) {
          session.status = "paused";
          writeSession(sessionDir, session);
          console.log(`\nSession paused. Resume with: office session continue ${session.id}`);
          server?.emit("paused", {});
          server?.stop();
          return;
        }

        if (userInput.trim().length > 0) {
          const { target, message } = parseUserInput(userInput);
          const speechLine = `${characterName} => ${target}: ${message}`;
          appendTimeline(sessionDir, speechLine);
          server?.emit("speech", { line: speechLine });
        }
      } else {
        console.log(`\n[${characterName}'s turn]`);
        server?.emit("turn", { character: characterName });
        const speechLine = await runCharacterAgent(characterName, sessionDir, session, config, projectRoot);
        printRecentTimeline(sessionDir, 3);
        server?.emit("speech", { line: speechLine });
      }

      session.turnPhase = "stage-manager-update";
      writeSession(sessionDir, session);
    }

    if (session.turnPhase === "stage-manager-update") {
      const narrationLines = await runStageManager(sessionDir, session, config, projectRoot);
      printRecentTimeline(sessionDir, 3);

      if (server) {
        if (narrationLines.length > 0) {
          server.emit("narration", { lines: narrationLines });
        }
        const characters: Record<string, unknown> = {};
        for (const name of session.characters) {
          characters[name] = readCharacterState(sessionDir, name);
        }
        server.emit("state", { characters });
      }

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
      server?.emit("paused", {});
      server?.stop();
      return;
    }

    session = readSession(sessionDir);
  }

  server?.stop();
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

function setupGracefulShutdown(sessionDir: string, server?: SessionServer): void {
  const handler = () => {
    try {
      const session = readSession(sessionDir);
      session.status = "paused";
      writeSession(sessionDir, session);
      console.log(`\nSession paused. Resume with: office session continue ${session.id}`);
      server?.emit("paused", {});
      server?.stop();
    } catch {
      // best effort
    }
    process.exit(0);
  };

  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
}
