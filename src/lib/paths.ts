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

export function commandTemplateDir(): string {
  return path.join(templateDir(), "commands");
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

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sessionDirName(description: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugify(description).slice(0, 50);
  return `${date}-${slug}`;
}
