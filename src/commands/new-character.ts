import path from "node:path";
import { charactersDir, slugify } from "../lib/paths.js";
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
    return firstWord.toLowerCase();
  }
  return slugify(description).slice(0, 30);
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
    },
    runner,
    config,
  );

  console.log(`\noffice new-character complete — check ${outputPath}`);
}
