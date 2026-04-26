import fs from "node:fs";
import path from "node:path";
import { spacesDir, slugify } from "../lib/paths.js";
import { readConfig } from "../lib/config.js";
import { runSpaceCreator, runSpaceSummarizer } from "../lib/persona.js";
import { appendLog } from "../lib/logger.js";

export interface NewSpaceOptions {
  name: string;
  projectRoot?: string;
}

export async function runNewSpace(
  description: string,
  opts: NewSpaceOptions,
): Promise<void> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const config = readConfig(projectRoot);
  const slug = slugify(opts.name);
  const outputPath = path.join(spacesDir(projectRoot), `${slug}.txt`);

  appendLog(projectRoot, "new-space", `starting | description="${description}" | name="${opts.name}" | outputPath="${outputPath}"`);
  console.log(`Creating space: ${description}`);

  await runSpaceCreator(description, outputPath, config, projectRoot);

  const ok = fs.existsSync(outputPath);
  if (ok) {
    appendLog(projectRoot, "new-space", `success — file created at ${outputPath}`);
    console.log(`\nSpace created: ${outputPath}`);

    const spaceText = fs.readFileSync(outputPath, "utf8");
    const summaryPath = path.join(spacesDir(projectRoot), `${slug}_summary.txt`);
    console.log("Generating space summary...");
    await runSpaceSummarizer(spaceText, summaryPath, config, projectRoot);
    console.log(`Summary created: ${summaryPath}`);
  } else {
    appendLog(projectRoot, "new-space", `FAILED — file not created at ${outputPath}`);
    console.error(`\nSpace creation failed — check .office/logs/ for details`);
    process.exit(1);
  }
}
