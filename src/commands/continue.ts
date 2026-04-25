import fs from "node:fs";
import path from "node:path";
import { sessionsDir } from "../lib/paths.js";
import { readSession, writeSession, sessionExists } from "../lib/session-io.js";
import { runSessionLoop } from "../lib/session-loop.js";

export interface ContinueOptions {
  projectRoot?: string;
}

export async function runContinue(
  sessionName: string,
  opts: ContinueOptions = {},
): Promise<void> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const sessionDir = path.join(sessionsDir(projectRoot), sessionName);

  if (!sessionExists(sessionDir)) {
    console.error(`Session not found: ${sessionDir}`);
    const available = listSessions(projectRoot);
    if (available.length > 0) {
      console.error(`Available sessions: ${available.join(", ")}`);
    }
    process.exit(1);
  }

  const session = readSession(sessionDir);

  if (session.status === "ended") {
    console.error("This session has ended and cannot be resumed.");
    process.exit(1);
  }

  console.log(`Resuming session: ${session.id}`);
  console.log(`Space: ${session.spaceName}`);
  console.log(`Characters: ${session.characters.join(", ")}`);
  console.log(`Round ${session.currentRound + 1}, ${session.characters[session.currentTurnIndex]}'s turn`);
  if (session.userCharacter) {
    console.log(`You are: ${session.userCharacter}`);
  }

  session.status = "active";
  writeSession(sessionDir, session);

  await runSessionLoop(sessionDir, { projectRoot });
}

function listSessions(projectRoot: string): string[] {
  const dir = sessionsDir(projectRoot);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => {
    return fs.existsSync(path.join(dir, name, "session.json"));
  });
}
