import { requireDocker, containerStatus, VOLUME_NAME } from "../lib/docker.js";

export async function runStatusDocker(): Promise<void> {
  await requireDocker();

  const status = await containerStatus();
  switch (status) {
    case "running":
      console.log("Office is running.");
      console.log(`Data volume: ${VOLUME_NAME}`);
      break;
    case "stopped":
      console.log("Office is stopped. Run 'office start' to resume.");
      console.log(`Data volume: ${VOLUME_NAME}`);
      break;
    case "not-created":
      console.log("Office has not been started yet. Run 'office start' to begin.");
      break;
  }
}
