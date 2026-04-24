import {
  requireDocker,
  isContainerRunning,
  stopContainer,
  removeContainer,
  removeImage,
  buildImage,
  createAndStartContainer,
  dockerExec,
} from "../lib/docker.js";

export async function runRestartDocker(): Promise<void> {
  await requireDocker();

  if (await isContainerRunning()) {
    console.log("Stopping container...");
    await stopContainer();
  }

  console.log("Removing container...");
  await removeContainer();

  console.log("Removing image...");
  await removeImage();

  console.log("Building image...");
  await buildImage();

  console.log("Creating container...");
  await createAndStartContainer();

  await dockerExec(["office", "_exec", "init"]);
  console.log("Office restarted.");
}
