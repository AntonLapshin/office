import fs from "node:fs";
import path from "node:path";
import { spacesDir, slugify } from "../lib/paths.js";
import { readConfig } from "../lib/config.js";
import { detectRunner } from "../lib/runner.js";
import { spawnPersona } from "../lib/persona.js";

export interface NewSpaceOptions {
  runner?: string;
  projectRoot?: string;
}

export async function runNewSpace(
  description: string,
  opts: NewSpaceOptions = {},
): Promise<void> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const config = readConfig(projectRoot);
  const runner = await detectRunner(opts.runner ?? config.runner ?? undefined);
  const slug = slugify(description);
  const outputPath = path.join(spacesDir(projectRoot), `${slug}.md`);

  console.log(`Creating space: ${description}`);

  await spawnPersona(
    "space-creator",
    {
      projectRoot,
      extraContext: {
        "Space description": description,
        "Output path": outputPath,
      },
    },
    runner,
    config,
  );

  if (fs.existsSync(outputPath)) {
    console.log(`\noffice new-space complete — check ${outputPath}`);
  } else {
    console.error(`\noffice new-space failed — the model did not create ${outputPath}`);
    process.exit(1);
  }
}
