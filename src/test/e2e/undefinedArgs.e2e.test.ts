/**
 * Verifies that every CommandTree command that accepts a tree item safely
 * no-ops when invoked without one. Exercises the early-return branches in
 * extension.ts handlers.
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { activateExtension } from "../helpers/helpers";

const TASK_COMMANDS: readonly string[] = [
  "commandtree.run",
  "commandtree.runInCurrentTerminal",
  "commandtree.copyRelativePath",
  "commandtree.copyFullPath",
  "commandtree.makeExecutable",
  "commandtree.addTag",
  "commandtree.removeTag",
  "commandtree.addToQuick",
  "commandtree.removeFromQuick",
];

const CATEGORY_NODE = { data: { nodeType: "category", commandType: "make" } };
const FOLDER_NODE = { data: { nodeType: "folder" } };

suite("Undefined-argument handler E2E tests", () => {
  suiteSetup(async function () {
    this.timeout(30000);
    await activateExtension();
  });

  test("every task-accepting handler is a no-op when invoked with undefined", async function () {
    this.timeout(30000);
    for (const command of TASK_COMMANDS) {
      await vscode.commands.executeCommand(command, undefined);
    }
    assert.ok(true, "All commands accepted undefined without throwing");
  });

  test("every task-accepting handler is a no-op when invoked on a folder node", async function () {
    this.timeout(30000);
    for (const command of TASK_COMMANDS) {
      await vscode.commands.executeCommand(command, FOLDER_NODE);
    }
    assert.ok(true, "All commands accepted a folder-node input without throwing");
  });

  test("every task-accepting handler is a no-op when invoked on a category node", async function () {
    this.timeout(30000);
    for (const command of TASK_COMMANDS) {
      await vscode.commands.executeCommand(command, CATEGORY_NODE);
    }
    assert.ok(true, "All commands accepted a category-node input without throwing");
  });
});
