/**
 * SPEC: command-tree-make-executable
 * E2E coverage for making script commands executable from the context menu.
 */

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import {
  activateExtension,
  collectLeafItems,
  executeCommand,
  getCommandTreeProvider,
  getExtensionPath,
} from "../helpers/helpers";
import { parsePackageJson } from "../helpers/test-types";
import type { PackageJsonMenuItem } from "../helpers/test-types";
import { isCommandItem } from "../../models/TaskItem";
import type { CommandTreeItem } from "../../models/TaskItem";

const MAKE_EXECUTABLE_COMMAND = "commandtree.makeExecutable";
const REFRESH_COMMAND = "commandtree.refresh";
const EXECUTE_BITS = 0o111;

function readContextMenus(): PackageJsonMenuItem[] {
  const content = fs.readFileSync(getExtensionPath("package.json"), "utf8");
  return parsePackageJson(content).contributes.menus?.["view/item/context"] ?? [];
}

function readPackageCommands(): string[] {
  const content = fs.readFileSync(getExtensionPath("package.json"), "utf8");
  return parsePackageJson(content).contributes.commands?.map((command) => command.command) ?? [];
}

function executableBits(filePath: string): number {
  return fs.statSync(filePath).mode & EXECUTE_BITS;
}

function clearExecutableBits(filePath: string): void {
  const currentMode = fs.statSync(filePath).mode;
  fs.chmodSync(filePath, currentMode & ~EXECUTE_BITS);
}

function assertMakeExecutableMenu(menu: PackageJsonMenuItem | undefined, viewId: string): void {
  assert.ok(menu !== undefined, `Make Executable should be in ${viewId} context menu`);
  assert.ok(menu.when?.includes(`view == ${viewId}`) === true, `Make Executable should target ${viewId}`);
  assert.ok(menu.when.includes("viewItem =~ /task.*/"), "Make Executable should target task rows");
  assert.ok(menu.when.includes("isMac") && menu.when.includes("isLinux"), "Make Executable should be non-Windows only");
}

async function findShellScriptItem(): Promise<CommandTreeItem> {
  const items = await collectLeafItems(getCommandTreeProvider());
  const item = items.find((candidate) => isCommandItem(candidate.data) && candidate.data.type === "shell");
  if (item === undefined) {
    assert.fail("CommandTree should expose a shell script row");
  }
  return item;
}

suite("Make Executable E2E Tests", () => {
  suiteSetup(async function () {
    this.timeout(30000);
    await activateExtension();
  });

  test("make executable command is registered and exposed for task rows on macOS and Linux", async function () {
    this.timeout(10000);
    const registeredCommands = await vscode.commands.getCommands(true);
    assert.ok(registeredCommands.includes(MAKE_EXECUTABLE_COMMAND), "Make Executable command should be registered");
    assert.ok(readPackageCommands().includes(MAKE_EXECUTABLE_COMMAND), "Make Executable should be in package.json");

    const menus = readContextMenus().filter((menu) => menu.command === MAKE_EXECUTABLE_COMMAND);
    assert.strictEqual(menus.length, 2, "Make Executable should appear in both CommandTree task views");
    assertMakeExecutableMenu(
      menus.find((menu) => menu.when?.includes("view == commandtree") === true),
      "commandtree"
    );
    assertMakeExecutableMenu(
      menus.find((menu) => menu.when?.includes("view == commandtree-quick") === true),
      "commandtree-quick"
    );
  });

  test("make executable command sets execute bits on a selected shell script", async function () {
    this.timeout(15000);
    await executeCommand(REFRESH_COMMAND);
    const item = await findShellScriptItem();
    assert.ok(isCommandItem(item.data), "Selected row should be backed by a command item");
    assert.strictEqual(item.data.type, "shell", "Selected row should be a shell script");
    assert.ok(path.isAbsolute(item.data.filePath), "Script path should be absolute");
    assert.ok(fs.existsSync(item.data.filePath), "Script file should exist before chmod");

    clearExecutableBits(item.data.filePath);
    assert.strictEqual(executableBits(item.data.filePath), 0, "Test setup should clear all execute bits");

    await vscode.commands.executeCommand(MAKE_EXECUTABLE_COMMAND, item);
    assert.strictEqual(executableBits(item.data.filePath), EXECUTE_BITS, "Make Executable should set chmod +x bits");

    await vscode.commands.executeCommand(MAKE_EXECUTABLE_COMMAND, undefined);
    assert.strictEqual(executableBits(item.data.filePath), EXECUTE_BITS, "Undefined selections should not change mode");
  });
});
