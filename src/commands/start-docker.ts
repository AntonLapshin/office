import {
  requireDocker,
  imageExists,
  containerExists,
  isContainerRunning,
  buildImage,
  createAndStartContainer,
  startContainer,
  dockerExec,
} from "../lib/docker.js";

export async function runStartDocker(): Promise<void> {
  await requireDocker();

  if (await isContainerRunning()) {
    console.log("Office is already running.");
    return;
  }

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
  console.log("Office is running.");
}
