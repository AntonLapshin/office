import fs from "node:fs";
import path from "node:path";
import { charactersDir, slugify, capitalize } from "../lib/paths.js";
import { readConfig } from "../lib/config.js";
import { runCharacterCreator } from "../lib/persona.js";
import { appendLog } from "../lib/logger.js";

export interface NewCharacterOptions {
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
  const name = extractName(description);
  const outputPath = path.join(charactersDir(projectRoot), `${name}.txt`);

  appendLog(projectRoot, "new-character", `starting | description="${description}" | name="${name}" | outputPath="${outputPath}"`);

  const charDir = charactersDir(projectRoot);
  const existingSummaries: string[] = [];
  if (fs.existsSync(charDir)) {
    for (const file of fs.readdirSync(charDir)) {
      if (file.endsWith(".txt") && file !== `${name}.txt`) {
        const charName = file.replace(".txt", "");
        const content = fs.readFileSync(path.join(charDir, file), "utf8");
        const firstLines = content.split("\n").slice(0, 2).join(" ").trim();
        existingSummaries.push(`- ${charName}: ${firstLines}`);
      }
    }
  }

  appendLog(projectRoot, "new-character", `${existingSummaries.length} existing character(s) as context`);
  console.log(`Creating character: ${description}`);

  await runCharacterCreator(description, name, outputPath, existingSummaries, config, projectRoot);

  const ok = fs.existsSync(outputPath);
  if (ok) {
    appendLog(projectRoot, "new-character", `success — file created at ${outputPath}`);
    console.log(`\nCharacter created: ${outputPath}`);
  } else {
    appendLog(projectRoot, "new-character", `FAILED — file not created at ${outputPath}`);
    console.error(`\nCharacter creation failed — check .office/logs/ for details`);
    process.exit(1);
  }
}
