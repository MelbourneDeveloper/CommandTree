/**
 * SPEC: command-tree-docker-execution
 * E2E coverage for executable Dockerfile and Docker Compose rows.
 */

import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import {
  activateExtension,
  collectLeafTasks,
  executeCommand,
  getCommandTreeProvider,
  getFixturePath,
} from "../helpers/helpers";
import type { CommandItem } from "../../models/TaskItem";

const REFRESH_COMMAND = "commandtree.refresh";
const DOCKERFILE_NAME = "Dockerfile";
const COMPOSE_FILE_NAME = "docker-compose.yml";

function dockerTasks(): CommandItem[] {
  return collectCachedTasks().filter((task) => task.type === "docker");
}

function collectCachedTasks(): CommandItem[] {
  return getCommandTreeProvider().getAllTasks();
}

function findDockerTask(label: string, fileName: string): CommandItem | undefined {
  return dockerTasks().find((task) => path.basename(task.filePath) === fileName && task.label === label);
}

function assertDockerTask(task: CommandItem | undefined, label: string): CommandItem {
  if (task === undefined) {
    assert.fail(`Expected Docker task: ${label}`);
  }
  assert.strictEqual(task.type, "docker", `${label} should be a docker task`);
  assert.ok(path.isAbsolute(task.filePath), `${label} should expose an absolute source path`);
  return task;
}

suite("Docker Execution E2E Tests", () => {
  let workspaceRoot = "";

  suiteSetup(async function () {
    this.timeout(30000);
    ({ workspaceRoot } = await activateExtension());
  });

  test("Dockerfile and compose rows execute with file-specific docker commands", async function () {
    this.timeout(20000);
    await executeCommand(REFRESH_COMMAND);
    const tasks = await collectLeafTasks(getCommandTreeProvider());
    const dockerTaskCount = tasks.filter((task) => task.type === "docker").length;
    assert.ok(dockerTaskCount >= 8, "Tree should expose Dockerfile, compose, and compose service rows");

    const dockerfilePath = getFixturePath(DOCKERFILE_NAME);
    const composePath = getFixturePath(COMPOSE_FILE_NAME);
    const dockerfileTask = assertDockerTask(findDockerTask("build Dockerfile", DOCKERFILE_NAME), "build Dockerfile");
    const composeUpTask = assertDockerTask(findDockerTask("up", COMPOSE_FILE_NAME), "docker compose up");
    const composeServiceTask = assertDockerTask(findDockerTask("up web", COMPOSE_FILE_NAME), "docker compose up web");

    assert.strictEqual(dockerfileTask.filePath, dockerfilePath, "Dockerfile task should point at Dockerfile");
    assert.strictEqual(dockerfileTask.cwd, workspaceRoot, "Dockerfile task should run from its directory");
    assert.strictEqual(dockerfileTask.command, `docker build -f "${dockerfilePath}" .`, "Dockerfile should build file");
    assert.strictEqual(composeUpTask.filePath, composePath, "Compose up should point at compose file");
    assert.strictEqual(composeUpTask.cwd, workspaceRoot, "Compose up should run from compose file directory");
    assert.strictEqual(composeUpTask.command, `docker compose -f "${composePath}" up`, "Compose up should use -f");
    assert.strictEqual(
      composeServiceTask.command,
      `docker compose -f "${composePath}" up web`,
      "Service up should use -f and the service name"
    );
    assert.ok(
      vscode.Uri.file(dockerfileTask.filePath).scheme === "file",
      "Dockerfile task path should become file URI"
    );
  });
});
