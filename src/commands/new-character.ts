import fs from "node:fs";
import path from "node:path";
import { charactersDir, slugify, capitalize } from "../lib/paths.js";
import { readConfig } from "../lib/config.js";
import { detectRunner } from "../lib/runner.js";
import { spawnPersona } from "../lib/persona.js";
import { appendLog, appendPerf } from "../lib/logger.js";

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
  const model = config.models["character-creator"] ?? null;

  appendLog(projectRoot, "new-character", `starting | description="${description}" | name="${name}" | outputPath="${outputPath}" | runner=${runner}`);

  const charDir = charactersDir(projectRoot);
  const embeddedFiles: Record<string, string> = {};
  if (fs.existsSync(charDir)) {
    for (const file of fs.readdirSync(charDir)) {
      if (file.endsWith(".md") && file !== `${name}.md`) {
        embeddedFiles[`Existing character: ${file.replace(".md", "")}`] = path.join(charDir, file);
      }
    }
  }

  const existingCount = Object.keys(embeddedFiles).length;
  appendLog(projectRoot, "new-character", `embedded ${existingCount} existing character(s) as context`);
  console.log(`Creating character: ${description}`);

  const startTime = Date.now();
  await spawnPersona(
    "character-creator",
    {
      projectRoot,
      extraContext: {
        "Character description": description,
        "Character name": name,
        "Output path": outputPath,
      },
      embeddedFiles: existingCount > 0 ? embeddedFiles : undefined,
    },
    runner,
    config,
  );
  const durationMs = Date.now() - startTime;

  const ok = fs.existsSync(outputPath);
  appendPerf(projectRoot, {
    role: "character-creator",
    model,
    runner,
    durationMs,
    status: ok ? "success" : "error",
  });

  if (ok) {
    appendLog(projectRoot, "new-character", `success — file created at ${outputPath}`);
    console.log(`\noffice new-character complete — check ${outputPath}`);
  } else {
    appendLog(projectRoot, "new-character", `FAILED — model did not create ${outputPath}`);
    console.error(`\noffice new-character failed — the model did not create ${outputPath}`);
    console.error(`Check .office/logs/ for the full persona output to diagnose the issue.`);
    process.exit(1);
  }
}
