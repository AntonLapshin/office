import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

export function templateDir(): string {
  const root = packageRoot();
  const srcTemplates = path.join(root, "src", "templates");
  if (fs.existsSync(srcTemplates)) return srcTemplates;
  return path.join(root, "templates");
}

export function personaTemplateDir(): string {
  return path.join(templateDir(), "personas");
}

export function officeRoot(projectRoot: string): string {
  return path.join(projectRoot, ".office");
}

export function spacesDir(projectRoot: string): string {
  return path.join(officeRoot(projectRoot), "spaces");
}

export function charactersDir(projectRoot: string): string {
  return path.join(officeRoot(projectRoot), "characters");
}

export function sessionsDir(projectRoot: string): string {
  return path.join(officeRoot(projectRoot), "sessions");
}

export function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sessionDirName(projectRoot: string): string {
  const dir = sessionsDir(projectRoot);
  if (!fs.existsSync(dir)) return "session_1";
  const entries = fs.readdirSync(dir);
  let maxNum = 0;
  for (const entry of entries) {
    const match = entry.match(/^session_(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `session_${maxNum + 1}`;
}
