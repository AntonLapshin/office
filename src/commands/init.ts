import fs from "node:fs";
import path from "node:path";
import { officeRoot } from "../lib/paths.js";
import { writeDefaultConfigIfMissing } from "../lib/config.js";

export async function runInit(projectRoot: string): Promise<void> {
  const office = officeRoot(projectRoot);
  for (const sub of ["spaces", "characters", "sessions"]) {
    fs.mkdirSync(path.join(office, sub), { recursive: true });
  }

  writeDefaultConfigIfMissing(projectRoot);
}
