#!/usr/bin/env node
import { Command } from "commander";
import { runInstall } from "./commands/install.js";
import { runStart } from "./commands/start.js";
import { runContinue } from "./commands/continue.js";
import { runNewSpace } from "./commands/new-space.js";
import { runNewCharacter } from "./commands/new-character.js";

const program = new Command();

program
  .name("office")
  .description("Virtual office simulation powered by LLM personas")
  .version("0.1.0");

program
  .command("install")
  .description("Bootstrap .office/ structure and install slash commands")
  .option("--project-root <path>", "override project root (defaults to cwd)")
  .action(async (options: { projectRoot?: string }) => {
    await runInstall(options);
  });

program
  .command("new-space")
  .description("Generate a new virtual office space from a description")
  .argument("<description...>", "brief space description")
  .option("--runner <claude|opencode>", "force a specific runner")
  .option("--project-root <path>", "override project root")
  .action(async (description: string[], options: { runner?: string; projectRoot?: string }) => {
    await runNewSpace(description.join(" "), options);
  });

program
  .command("new-character")
  .description("Generate a new virtual office character from a description")
  .argument("<description...>", "brief character description")
  .option("--runner <claude|opencode>", "force a specific runner")
  .option("--project-root <path>", "override project root")
  .action(async (description: string[], options: { runner?: string; projectRoot?: string }) => {
    await runNewCharacter(description.join(" "), options);
  });

program
  .command("start")
  .description("Create and run a new session")
  .requiredOption("--space <name>", "space name (from .office/spaces/)")
  .requiredOption("--characters <names>", "comma-separated character names")
  .option("--description <text>", "session description", "Office simulation")
  .option("--user <name>", "character controlled by the human user")
  .option("--runner <claude|opencode>", "force a specific runner")
  .option("--project-root <path>", "override project root")
  .action(async (options: {
    space: string;
    characters: string;
    description?: string;
    user?: string;
    runner?: string;
    projectRoot?: string;
  }) => {
    await runStart(options);
  });

program
  .command("continue")
  .description("Resume an existing session")
  .argument("<session_name>", "session directory name")
  .option("--runner <claude|opencode>", "force a specific runner")
  .option("--project-root <path>", "override project root")
  .action(async (sessionName: string, options: { runner?: string; projectRoot?: string }) => {
    await runContinue(sessionName, options);
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
