import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execa } from "execa";
import { packageRoot } from "./paths.js";

export const CONTAINER_NAME = "office-sim";
export const IMAGE_NAME = "office-sim:latest";
export const VOLUME_NAME = "office-data";
export const CONTAINER_WORKDIR = "/data";

export async function requireDocker(): Promise<void> {
  const cmd = process.platform === "win32" ? "where" : "which";
  try {
    const res = await execa(cmd, ["docker"], { reject: false });
    if (res.exitCode !== 0) throw new Error();
  } catch {
    console.error("Docker is required but not found on PATH.");
    console.error("Install it from https://docker.com");
    process.exit(1);
  }
}

export async function imageExists(): Promise<boolean> {
  const res = await execa("docker", ["image", "inspect", IMAGE_NAME], {
    reject: false,
    stdio: "pipe",
  });
  return res.exitCode === 0;
}

export async function containerExists(): Promise<boolean> {
  const res = await execa(
    "docker",
    ["container", "inspect", CONTAINER_NAME],
    { reject: false, stdio: "pipe" },
  );
  return res.exitCode === 0;
}

export async function isContainerRunning(): Promise<boolean> {
  const res = await execa(
    "docker",
    ["inspect", "--format", "{{.State.Running}}", CONTAINER_NAME],
    { reject: false, stdio: "pipe" },
  );
  return res.exitCode === 0 && res.stdout.trim() === "true";
}

export async function buildImage(): Promise<void> {
  console.log("Building office-sim Docker image (this may take a few minutes)...");
  await execa("docker", ["build", "-t", IMAGE_NAME, packageRoot()], {
    stdio: "inherit",
  });
  console.log("Image built successfully.");
}

function buildContainerFlags(): string[] {
  const flags: string[] = [
    "-v", `${VOLUME_NAME}:${CONTAINER_WORKDIR}/.office`,
    "--add-host", "host.docker.internal:host-gateway",
  ];

  const claudeDir = path.join(os.homedir(), ".claude");
  if (fs.existsSync(claudeDir)) {
    flags.push("-v", `${claudeDir}:/root/.claude:ro`);
  }

  const opencodeConfig = path.join(process.cwd(), "opencode.json");
  if (fs.existsSync(opencodeConfig)) {
    flags.push("-v", `${opencodeConfig}:${CONTAINER_WORKDIR}/opencode.json:ro`);
  }

  const officeConfig = path.join(process.cwd(), "config.json");
  if (fs.existsSync(officeConfig)) {
    flags.push("-v", `${officeConfig}:${CONTAINER_WORKDIR}/.office/config.json:ro`);
  }

  const passthroughEnv = ["ANTHROPIC_API_KEY", "OFFICE_RUNNER"];
  for (const key of passthroughEnv) {
    if (process.env[key]) {
      flags.push("-e", `${key}=${process.env[key]}`);
    }
  }

  return flags;
}

export async function createAndStartContainer(): Promise<void> {
  await execa("docker", ["volume", "create", VOLUME_NAME], {
    reject: false,
    stdio: "pipe",
  });

  const flags = buildContainerFlags();
  await execa(
    "docker",
    ["create", "--name", CONTAINER_NAME, ...flags, IMAGE_NAME],
    { stdio: "inherit" },
  );

  await execa("docker", ["start", CONTAINER_NAME], { stdio: "pipe" });
}

export async function startContainer(): Promise<void> {
  await execa("docker", ["start", CONTAINER_NAME], { stdio: "pipe" });
}

export async function stopContainer(): Promise<void> {
  await execa("docker", ["stop", CONTAINER_NAME], { stdio: "pipe" });
}

export async function removeContainer(): Promise<void> {
  await execa("docker", ["rm", "-f", CONTAINER_NAME], {
    reject: false,
    stdio: "pipe",
  });
}

export async function removeImage(): Promise<void> {
  await execa("docker", ["rmi", IMAGE_NAME], {
    reject: false,
    stdio: "pipe",
  });
}

export async function dockerExec(args: string[]): Promise<void> {
  const flags: string[] = ["-i"];
  if (process.stdout.isTTY) flags.push("-t");

  const res = await execa(
    "docker",
    ["exec", ...flags, CONTAINER_NAME, ...args],
    { stdio: "inherit", reject: false },
  );

  if (res.exitCode !== 0) {
    process.exit(res.exitCode ?? 1);
  }
}

export async function ensureRunning(): Promise<void> {
  await requireDocker();

  if (await isContainerRunning()) return;

  if (!(await imageExists())) {
    await buildImage();
  }

  if (await containerExists()) {
    console.log("Starting office container...");
    await startContainer();
  } else {
    console.log("Creating office container...");
    await createAndStartContainer();
  }

  await dockerExec(["office", "_exec", "init"]);
  console.log("Office is running.\n");
}

export async function containerStatus(): Promise<"running" | "stopped" | "not-created"> {
  if (!(await containerExists())) return "not-created";
  if (await isContainerRunning()) return "running";
  return "stopped";
}
