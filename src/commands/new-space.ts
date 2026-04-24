import fs from "node:fs";
import path from "node:path";
import { spacesDir, slugify } from "../lib/paths.js";
import { readConfig } from "../lib/config.js";
import { detectRunner } from "../lib/runner.js";
import { spawnPersona } from "../lib/persona.js";
import { appendLog, appendPerf } from "../lib/logger.js";

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
  const model = config.models["space-creator"] ?? null;

  appendLog(projectRoot, "new-space", `starting | description="${description}" | slug="${slug}" | outputPath="${outputPath}" | runner=${runner}`);
  console.log(`Creating space: ${description}`);

  const startTime = Date.now();
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
  const durationMs = Date.now() - startTime;

  const ok = fs.existsSync(outputPath);
  appendPerf(projectRoot, {
    role: "space-creator",
    model,
    runner,
    durationMs,
    status: ok ? "success" : "error",
  });

  if (ok) {
    appendLog(projectRoot, "new-space", `success — file created at ${outputPath}`);
    console.log(`\noffice new-space complete — check ${outputPath}`);
  } else {
    appendLog(projectRoot, "new-space", `FAILED — model did not create ${outputPath}`);
    console.error(`\noffice new-space failed — the model did not create ${outputPath}`);
    console.error(`Check .office/logs/ for the full persona output to diagnose the issue.`);
    process.exit(1);
  }
}
