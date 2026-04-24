import {
  requireDocker,
  isContainerRunning,
  stopContainer,
  VOLUME_NAME,
} from "../lib/docker.js";

export async function runStopDocker(): Promise<void> {
  await requireDocker();

  if (!(await isContainerRunning())) {
    console.log("Office is not running.");
    return;
  }

  await stopContainer();
  console.log(`Office stopped. Data preserved in volume '${VOLUME_NAME}'.`);
}
