#!/usr/bin/env node
import { Command } from "commander";
import { loadEnv } from "./lib/env.js";
import { runInit } from "./commands/init.js";
import { runNewSpace } from "./commands/new-space.js";
import { runNewCharacter } from "./commands/new-character.js";
import { runStart } from "./commands/start.js";
import { runContinue } from "./commands/continue.js";
import { runAddCharacter } from "./commands/add-character.js";
import { runList, type ListTarget } from "./commands/list.js";

const program = new Command();

loadEnv(process.cwd());

program
  .name("office")
  .description("Virtual office simulation powered by LLM personas")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize .office directory structure")
  .action(async () => {
    await runInit(process.cwd());
    console.log("Initialized .office/");
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
    await runNewCharacter(description.join(" "), { projectRoot: process.cwd() });
  });

character
  .command("list")
  .description("List all characters")
  .action(() => {
    runList("characters", process.cwd());
  });

// -- space -------------------------------------------------------------------

const space = program
  .command("space")
  .description("Manage spaces");

space
  .command("create")
  .description("Generate a new space from a description")
  .argument("<description...>", "brief space description")
  .requiredOption("--name <name>", "name for the space file")
  .action(async (description: string[], cmdOpts: { name: string }) => {
    await runNewSpace(description.join(" "), { name: cmdOpts.name, projectRoot: process.cwd() });
  });

space
  .command("list")
  .description("List all spaces")
  .action(() => {
    runList("spaces", process.cwd());
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
  .option("--port <port>", "start API server on this port")
  .action(async (opts: {
    space: string;
    characters: string;
    description?: string;
    user?: string;
    port?: string;
  }) => {
    await runStart({
      space: opts.space,
      characters: opts.characters,
      description: opts.description,
      user: opts.user,
      port: opts.port ? parseInt(opts.port, 10) : undefined,
      projectRoot: process.cwd(),
    });
  });

session
  .command("continue")
  .description("Resume a paused session")
  .argument("<session_name>", "session directory name")
  .option("--port <port>", "start API server on this port")
  .action(async (sessionName: string, cmdOpts: { port?: string }) => {
    await runContinue(sessionName, {
      port: cmdOpts.port ? parseInt(cmdOpts.port, 10) : undefined,
      projectRoot: process.cwd(),
    });
  });

session
  .command("add-character")
  .description("Add a character to an existing session")
  .argument("<session_name>", "session directory name")
  .requiredOption("--character <name>", "character name to add")
  .action(async (sessionName: string, cmdOpts: { character: string }) => {
    await runAddCharacter(sessionName, cmdOpts.character, { projectRoot: process.cwd() });
  });

session
  .command("list")
  .description("List all sessions")
  .action(() => {
    runList("sessions", process.cwd());
  });

// ---------------------------------------------------------------------------

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
