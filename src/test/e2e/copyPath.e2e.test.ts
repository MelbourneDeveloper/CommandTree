/**
 * SPEC: command-tree-copy-path
 * E2E coverage for copying task file paths from CommandTree context menus.
 */

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { activateExtension, collectLeafItems, getCommandTreeProvider, getExtensionPath } from "../helpers/helpers";
import { parsePackageJson } from "../helpers/test-types";
import type { PackageJsonMenuItem } from "../helpers/test-types";
import { isCommandItem } from "../../models/TaskItem";
import type { CommandItem, CommandTreeItem } from "../../models/TaskItem";

const COPY_RELATIVE_COMMAND = "commandtree.copyRelativePath";
const COPY_FULL_COMMAND = "commandtree.copyFullPath";
const SENTINEL_CLIPBOARD = "sentinel clipboard value";

function readPackageJsonCommands(): string[] {
  const content = fs.readFileSync(getExtensionPath("package.json"), "utf8");
  return parsePackageJson(content).contributes.commands?.map((command) => command.command) ?? [];
}

function readContextMenus(): PackageJsonMenuItem[] {
  const content = fs.readFileSync(getExtensionPath("package.json"), "utf8");
  return parsePackageJson(content).contributes.menus?.["view/item/context"] ?? [];
}

function menuFor(command: string): PackageJsonMenuItem | undefined {
  return readContextMenus().find((menu) => menu.command === command);
}

function assertTaskContextMenu(command: string): void {
  const menu = menuFor(command);
  assert.ok(menu !== undefined, `${command} should be contributed to the task context menu`);
  assert.ok(menu.when?.includes("view == commandtree") === true, `${command} should appear in CommandTree`);
  assert.ok(menu.when.includes("viewItem"), `${command} should be scoped to task tree items`);
}

async function findCommandTreeFileItem(): Promise<CommandTreeItem> {
  const items = await collectLeafItems(getCommandTreeProvider());
  const buildScript = items.find((item) => isCommandItem(item.data) && item.data.filePath.endsWith("scripts/build.sh"));
  const fallback = items.find((item) => isCommandItem(item.data) && item.data.filePath !== "");
  const item = buildScript ?? fallback;
  if (item === undefined) {
    assert.fail("CommandTree should expose at least one file-backed command item");
  }
  return item;
}

function taskFromItem(item: CommandTreeItem): CommandItem {
  if (!isCommandItem(item.data)) {
    assert.fail("Expected a command tree item backed by a command");
  }
  return item.data;
}

async function assertClipboardValue(expected: string, message: string): Promise<void> {
  const actual = await vscode.env.clipboard.readText();
  assert.strictEqual(actual, expected, message);
}

suite("Copy Path E2E Tests", () => {
  let workspaceRoot = "";

  suiteSetup(async function () {
    this.timeout(30000);
    ({ workspaceRoot } = await activateExtension());
  });

  test("copy path commands are registered and exposed on task context menus", async function () {
    this.timeout(10000);
    const registeredCommands = await vscode.commands.getCommands(true);
    assert.ok(registeredCommands.includes(COPY_RELATIVE_COMMAND), "Copy Relative Path command should be registered");
    assert.ok(registeredCommands.includes(COPY_FULL_COMMAND), "Copy Full Path command should be registered");

    const contributedCommands = readPackageJsonCommands();
    assert.ok(contributedCommands.includes(COPY_RELATIVE_COMMAND), "Copy Relative Path should be in package.json");
    assert.ok(contributedCommands.includes(COPY_FULL_COMMAND), "Copy Full Path should be in package.json");
    assertTaskContextMenu(COPY_RELATIVE_COMMAND);
    assertTaskContextMenu(COPY_FULL_COMMAND);
  });

  test("copy path commands copy relative and full paths for command tree items", async function () {
    this.timeout(15000);
    const item = await findCommandTreeFileItem();
    const task = taskFromItem(item);
    const relativePath = path.relative(workspaceRoot, task.filePath);

    assert.ok(task.filePath.length > 0, "Task should expose a file path");
    assert.ok(path.isAbsolute(task.filePath), "Full path should be absolute");
    assert.ok(relativePath.length > 0, "Relative path should not be empty");
    assert.ok(!path.isAbsolute(relativePath), "Relative path should not be absolute");

    await vscode.env.clipboard.writeText(SENTINEL_CLIPBOARD);
    await vscode.commands.executeCommand(COPY_RELATIVE_COMMAND, item);
    await assertClipboardValue(relativePath, "Copy Relative Path should write workspace-relative path");

    await vscode.commands.executeCommand(COPY_FULL_COMMAND, item);
    await assertClipboardValue(task.filePath, "Copy Full Path should write absolute file path");

    await vscode.env.clipboard.writeText(SENTINEL_CLIPBOARD);
    await vscode.commands.executeCommand(COPY_RELATIVE_COMMAND, undefined);
    await assertClipboardValue(SENTINEL_CLIPBOARD, "Undefined items should not change the clipboard");

    await vscode.env.clipboard.writeText(SENTINEL_CLIPBOARD);
    await vscode.commands.executeCommand(COPY_FULL_COMMAND, undefined);
    await assertClipboardValue(SENTINEL_CLIPBOARD, "Copy Full Path must be a no-op when invoked with no tree item");

    await vscode.env.clipboard.writeText(SENTINEL_CLIPBOARD);
    await vscode.commands.executeCommand(COPY_FULL_COMMAND, { data: { nodeType: "category", commandType: "make" } });
    await assertClipboardValue(
      SENTINEL_CLIPBOARD,
      "Copy Full Path must be a no-op when invoked on a non-command tree node"
    );

    await vscode.env.clipboard.writeText(SENTINEL_CLIPBOARD);
    await vscode.commands.executeCommand(COPY_RELATIVE_COMMAND, { data: { nodeType: "folder" } });
    await assertClipboardValue(
      SENTINEL_CLIPBOARD,
      "Copy Relative Path must be a no-op when invoked on a folder tree node"
    );
  });
});
