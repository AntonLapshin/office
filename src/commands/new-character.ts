import fs from "node:fs";
import path from "node:path";
import { charactersDir, slugify, capitalize } from "../lib/paths.js";
import { readConfig } from "../lib/config.js";
import { detectRunner } from "../lib/runner.js";
import { spawnPersona } from "../lib/persona.js";

export interface NewCharacterOptions {
  runner?: string;
  projectRoot?: string;
}

function extractName(description: string): string {
  const firstWord = description.split(/[\s,]+/)[0];
  if (firstWord && /^[A-Z]/.test(firstWord)) {
    return firstWord;
  }
  return capitalize(slugify(description).slice(0, 30));
}

export async function runNewCharacter(
  description: string,
  opts: NewCharacterOptions = {},
): Promise<void> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const config = readConfig(projectRoot);
  const runner = await detectRunner(opts.runner ?? config.runner ?? undefined);
  const name = extractName(description);
  const outputPath = path.join(charactersDir(projectRoot), `${name}.md`);

  const charDir = charactersDir(projectRoot);
  const embeddedFiles: Record<string, string> = {};
  if (fs.existsSync(charDir)) {
    for (const file of fs.readdirSync(charDir)) {
      if (file.endsWith(".md") && file !== `${name}.md`) {
        embeddedFiles[`Existing character: ${file.replace(".md", "")}`] = path.join(charDir, file);
      }
    }
  }

  console.log(`Creating character: ${description}`);

  await spawnPersona(
    "character-creator",
    {
      projectRoot,
      extraContext: {
        "Character description": description,
        "Character name": name,
        "Output path": outputPath,
      },
      embeddedFiles: Object.keys(embeddedFiles).length > 0 ? embeddedFiles : undefined,
    },
    runner,
    config,
  );

  console.log(`\noffice new-character complete — check ${outputPath}`);
}
