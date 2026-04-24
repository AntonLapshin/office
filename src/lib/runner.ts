import { execa } from "execa";

export type Runner = "claude" | "opencode";

export async function detectRunner(override?: string): Promise<Runner> {
  const forced = override ?? process.env.OFFICE_RUNNER;
  if (forced === "claude" || forced === "opencode") return forced;

  if (process.env.CLAUDECODE === "1" || process.env.CLAUDE_CODE === "1") return "claude";
  if (process.env.OPENCODE === "1") return "opencode";

  if (await onPath("claude")) return "claude";
  if (await onPath("opencode")) return "opencode";

  throw new Error(
    "Neither `claude` nor `opencode` found on PATH. Set OFFICE_RUNNER=claude|opencode or pass --runner.",
  );
}

async function onPath(bin: string): Promise<boolean> {
  const cmd = process.platform === "win32" ? "where" : "which";
  try {
    const res = await execa(cmd, [bin], { reject: false });
    return res.exitCode === 0 && res.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export function buildRunnerArgs(
  runner: Runner,
  prompt: string,
  model?: string | null,
): string[] {
  if (runner === "claude") {
    const args = ["-p", prompt, "--permission-mode", "bypassPermissions"];
    if (model) args.push("--model", model);
    return args;
  }
  const args = ["run", prompt];
  if (model) args.push("--model", model);
  return args;
}

export function runnerBinary(runner: Runner): string {
  return runner;
}
