#!/usr/bin/env node
import { Command } from "commander";
import { ensureRunning, dockerExec } from "./lib/docker.js";
import { runStartDocker } from "./commands/start-docker.js";
import { runStopDocker } from "./commands/stop-docker.js";
import { runStatusDocker } from "./commands/status-docker.js";
import { runInit } from "./commands/init.js";
import { runNewSpace } from "./commands/new-space.js";
import { runNewCharacter } from "./commands/new-character.js";
import { runStart } from "./commands/start.js";
import { runContinue } from "./commands/continue.js";
import { runList, type ListTarget } from "./commands/list.js";

const program = new Command();

program
  .name("office")
  .description("Virtual office simulation powered by LLM personas")
  .version("0.1.0");

// ---------------------------------------------------------------------------
// Host-side commands (delegate to Docker container)
// ---------------------------------------------------------------------------

program
  .command("start")
  .description("Start the office container (builds image on first run)")
  .action(async () => {
    await runStartDocker();
  });

program
  .command("stop")
  .description("Stop the office container")
  .action(async () => {
    await runStopDocker();
  });

program
  .command("status")
  .description("Show office container status")
  .action(async () => {
    await runStatusDocker();
  });

// -- character ---------------------------------------------------------------

const character = program
  .command("character")
  .description("Manage characters");

character
  .command("create")
  .description("Generate a new character from a description")
  .argument("<description...>", "brief character description")
  .action(async (description: string[]) => {
    await ensureRunning();
    await dockerExec(
      ["office", "_exec", "new-character", description.join(" ")],
    );
  });

character
  .command("list")
  .description("List all characters")
  .action(async () => {
    await ensureRunning();
    await dockerExec(["office", "_exec", "list", "characters"]);
  });

// -- space -------------------------------------------------------------------

const space = program
  .command("space")
  .description("Manage spaces");

space
  .command("create")
  .description("Generate a new space from a description")
  .argument("<description...>", "brief space description")
  .action(async (description: string[]) => {
    await ensureRunning();
    await dockerExec(
      ["office", "_exec", "new-space", description.join(" ")],
    );
  });

space
  .command("list")
  .description("List all spaces")
  .action(async () => {
    await ensureRunning();
    await dockerExec(["office", "_exec", "list", "spaces"]);
  });

// -- session -----------------------------------------------------------------

const session = program
  .command("session")
  .description("Manage sessions");

session
  .command("start")
  .description("Create and run a new session")
  .requiredOption("--space <name>", "space name")
  .requiredOption("--characters <names>", "comma-separated character names")
  .option("--description <text>", "session description", "Office simulation")
  .option("--user <name>", "character controlled by the human user")
  .action(async (opts: {
    space: string;
    characters: string;
    description?: string;
    user?: string;
  }) => {
    await ensureRunning();
    const args = [
      "office", "_exec", "session-start",
      "--space", opts.space,
      "--characters", opts.characters,
    ];
    if (opts.description) args.push("--description", opts.description);
    if (opts.user) args.push("--user", opts.user);
    await dockerExec(args, { interactive: true });
  });

session
  .command("continue")
  .description("Resume a paused session")
  .argument("<session_name>", "session directory name")
  .action(async (sessionName: string) => {
    await ensureRunning();
    await dockerExec(
      ["office", "_exec", "session-continue", sessionName],
      { interactive: true },
    );
  });

session
  .command("list")
  .description("List all sessions")
  .action(async () => {
    await ensureRunning();
    await dockerExec(["office", "_exec", "list", "sessions"]);
  });

// ---------------------------------------------------------------------------
// Internal commands (run inside the container, hidden from top-level help)
// ---------------------------------------------------------------------------

const internal = program.command("_exec", { hidden: true });

internal
  .command("init")
  .action(async () => {
    await runInit(process.cwd());
  });

internal
  .command("new-character")
  .argument("<description...>", "brief character description")
  .action(async (description: string[]) => {
    await runNewCharacter(description.join(" "), { projectRoot: process.cwd() });
  });

internal
  .command("new-space")
  .argument("<description...>", "brief space description")
  .action(async (description: string[]) => {
    await runNewSpace(description.join(" "), { projectRoot: process.cwd() });
  });

internal
  .command("session-start")
  .requiredOption("--space <name>", "space name")
  .requiredOption("--characters <names>", "comma-separated character names")
  .option("--description <text>", "session description", "Office simulation")
  .option("--user <name>", "character controlled by the human user")
  .action(async (opts: {
    space: string;
    characters: string;
    description?: string;
    user?: string;
  }) => {
    await runStart({
      space: opts.space,
      characters: opts.characters,
      description: opts.description,
      user: opts.user,
      projectRoot: process.cwd(),
    });
  });

internal
  .command("session-continue")
  .argument("<session_name>", "session directory name")
  .action(async (sessionName: string) => {
    await runContinue(sessionName, { projectRoot: process.cwd() });
  });

internal
  .command("list")
  .argument("<target>", "spaces, characters, or sessions")
  .action((target: string) => {
    const valid: ListTarget[] = ["spaces", "characters", "sessions"];
    if (!valid.includes(target as ListTarget)) {
      console.error(`Unknown target: ${target}. Use one of: ${valid.join(", ")}`);
      process.exit(1);
    }
    runList(target as ListTarget, process.cwd());
  });

// ---------------------------------------------------------------------------

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
