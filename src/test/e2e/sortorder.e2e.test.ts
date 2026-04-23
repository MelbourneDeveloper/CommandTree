import * as assert from "assert";
import * as vscode from "vscode";
import {
  activateExtension,
  deleteFile,
  getCommandTreeProvider,
  getLabelString,
  refreshTasks,
  writeFile,
} from "../helpers/helpers";
import type { CommandItem, CommandTreeItem } from "../../models/TaskItem";
import { isCommandItem, isPrivateTask } from "../../models/TaskItem";

const SORT_ORDER_KEY = "sortOrder";
const SORT_ORDER_FOLDER = "sort-order";
const MAKEFILE_PATH = `${SORT_ORDER_FOLDER}/Makefile`;
const PACKAGE_JSON_PATH = `${SORT_ORDER_FOLDER}/package.json`;
const ALPHA_SHELL_PATH = `${SORT_ORDER_FOLDER}/alpha.sh`;
const ZETA_SHELL_PATH = `${SORT_ORDER_FOLDER}/zeta.sh`;
const PRIVATE_RULE_PREFIX = "_";
type CommandTreeCommandItem = CommandTreeItem & { readonly data: CommandItem };

function assertCommandTreeCommandItem(item: CommandTreeItem, label: string): asserts item is CommandTreeCommandItem {
  assert.ok(isCommandItem(item.data), `${label} should be a command item`);
}

async function getFolderChildren(categoryLabel: string, folderLabel: string): Promise<CommandTreeItem[]> {
  const provider = getCommandTreeProvider();
  const categories = await provider.getChildren();
  const category = categories.find((item) => getLabelString(item.label).includes(categoryLabel));
  assert.ok(category !== undefined, `Should find category ${categoryLabel}`);

  const children = await provider.getChildren(category);
  const folder = children.find((item) => getLabelString(item.label) === folderLabel);
  assert.ok(folder !== undefined, `Should find folder ${folderLabel}`);

  return await provider.getChildren(folder);
}

function labelsOf(items: readonly CommandTreeItem[]): string[] {
  return items.map((item) => getLabelString(item.label));
}

function compareCommandLabels(a: CommandTreeItem, b: CommandTreeItem): number {
  const aTask = isCommandItem(a.data) ? a.data : undefined;
  const bTask = isCommandItem(b.data) ? b.data : undefined;
  assert.ok(aTask !== undefined && bTask !== undefined, "Only command items can be sorted as commands");
  return (
    Number(isPrivateTask(aTask)) - Number(isPrivateTask(bTask)) ||
    aTask.label.localeCompare(bTask.label, undefined, { sensitivity: "base" })
  );
}

async function updateSortOrder(value: string | undefined): Promise<void> {
  await vscode.workspace
    .getConfiguration("commandtree")
    .update(SORT_ORDER_KEY, value, vscode.ConfigurationTarget.Workspace);
}

function assertNoStrayRow(item: CommandTreeItem): void {
  const label = getLabelString(item.label);
  assert.notStrictEqual(label, "...", "The all-commands tree must not render a stray ellipsis row");
  assert.ok(!label.includes("\u2500"), `The all-commands tree must not render divider row "${label}"`);
  assert.notStrictEqual(item.contextValue, "divider", "The all-commands tree must not contain divider tree items");
  assert.notStrictEqual(item.contextValue, "placeholder", "The all-commands tree must not contain placeholder rows");
}

function assertCommandChildrenSorted(items: readonly CommandTreeItem[]): void {
  const commands = items.filter((item) => isCommandItem(item.data));
  const actual = labelsOf(commands);
  const expected = labelsOf([...commands].sort(compareCommandLabels));
  assert.deepStrictEqual(
    actual,
    expected,
    `Command siblings should be sorted by configured order: ${actual.join(", ")}`
  );
}

async function assertSortedAndCleanSubtree(item: CommandTreeItem): Promise<void> {
  assertNoStrayRow(item);
  const provider = getCommandTreeProvider();
  const children = await provider.getChildren(item);
  assertCommandChildrenSorted(children);
  for (const child of children) {
    await assertSortedAndCleanSubtree(child);
  }
}

async function assertWholeTreeHasNoStrayRowsAndSortedCommands(): Promise<void> {
  const roots = await getCommandTreeProvider().getChildren();
  assertCommandChildrenSorted(roots);
  for (const root of roots) {
    await assertSortedAndCleanSubtree(root);
  }
}

function commandItemWithLabel(items: readonly CommandTreeItem[], label: string): CommandTreeCommandItem {
  const item = items.find((candidate) => getLabelString(candidate.label) === label);
  assert.ok(item !== undefined, `Should find command ${label}`);
  assertCommandTreeCommandItem(item, label);
  assertNoStrayRow(item);
  return item;
}

function assertAllCommands(items: readonly CommandTreeItem[]): void {
  assert.ok(items.length > 0, "Expected visible command rows");
  for (const item of items) {
    assert.ok(isCommandItem(item.data), `${getLabelString(item.label)} should be a command item`);
    assertNoStrayRow(item);
    assert.strictEqual(item.contextValue, "task", `${getLabelString(item.label)} should be a normal task row`);
  }
}

async function clickTreeItem(item: CommandTreeItem): Promise<void> {
  assert.ok(item.command !== undefined, `${getLabelString(item.label)} should have a click command`);
  const args = (item.command.arguments ?? []) as [vscode.Uri, ...unknown[]];
  await vscode.commands.executeCommand(item.command.command, ...args);
}

function assertActiveEditorEndsWith(pathSuffix: string): void {
  const editor = vscode.window.activeTextEditor;
  assert.ok(editor !== undefined, "Clicking a tree item should open an editor");
  assert.ok(editor.document.uri.fsPath.endsWith(pathSuffix), `Opened file should end with ${pathSuffix}`);
}

function assertCursorMatchesTaskLine(item: CommandTreeItem): void {
  assert.ok(isCommandItem(item.data), "Clicked row should be a command item");
  assert.ok(item.data.line !== undefined, `${item.data.label} should have a source line`);
  const editor = vscode.window.activeTextEditor;
  assert.ok(editor !== undefined, "Clicked item should leave an active editor");
  assert.strictEqual(editor.selection.active.line, item.data.line - 1, "Cursor should land on the task source line");
}

suite("Sort Order E2E Tests", () => {
  let originalSortOrder: string | undefined;

  suiteSetup(async function () {
    this.timeout(30000);
    await activateExtension();
  });

  setup(function () {
    this.timeout(15000);
    const config = vscode.workspace.getConfiguration("commandtree");
    originalSortOrder = config.get<string>(SORT_ORDER_KEY);

    writeFile(
      MAKEFILE_PATH,
      [
        ".PHONY: zeta help _coverage_check",
        "",
        "zeta:",
        '\t@echo "zeta"',
        "",
        "help:",
        '\t@echo "help"',
        "",
        "alpha:",
        '\t@echo "alpha"',
        "",
        "COVERAGE_THRESHOLDS_FILE:",
        '\t@echo "coverage"',
        "",
        "UNAME:",
        '\t@echo "uname"',
        "",
        "build:",
        '\t@echo "build"',
        "",
        "_coverage_check:",
        '\t@echo "private"',
      ].join("\n")
    );

    writeFile(
      PACKAGE_JSON_PATH,
      JSON.stringify(
        {
          scripts: {
            zeta: "echo zeta",
            alpha: "echo alpha",
            middle: "echo middle",
            Beta: "echo beta",
          },
        },
        null,
        2
      )
    );

    writeFile(ALPHA_SHELL_PATH, ["#!/usr/bin/env bash", "# Alpha shell fixture", "echo alpha"].join("\n"));
    writeFile(ZETA_SHELL_PATH, ["#!/usr/bin/env bash", "# Zeta shell fixture", "echo zeta"].join("\n"));
  });

  teardown(async function () {
    this.timeout(15000);
    deleteFile(MAKEFILE_PATH);
    deleteFile(PACKAGE_JSON_PATH);
    deleteFile(ALPHA_SHELL_PATH);
    deleteFile(ZETA_SHELL_PATH);
    await updateSortOrder(originalSortOrder);
    await refreshTasks();
  });

  test("default Make target order is alphabetical case-insensitive with private rules last", async function () {
    this.timeout(15000);
    await vscode.commands.executeCommand("commandtree.clearFilter");
    await updateSortOrder(undefined);
    await refreshTasks();

    const makeItems = await getFolderChildren("Make Targets", SORT_ORDER_FOLDER);
    const makeLabels = labelsOf(makeItems);
    const alpha = commandItemWithLabel(makeItems, "alpha");
    const privateRule = commandItemWithLabel(makeItems, "_coverage_check");

    assertAllCommands(makeItems);
    assert.deepStrictEqual(
      makeLabels,
      ["alpha", "build", "COVERAGE_THRESHOLDS_FILE", "help", "UNAME", "zeta", "_coverage_check"],
      "Default Make target order must be alphabetical, case-insensitive, with private rules last"
    );
    assert.strictEqual(makeLabels[0], "alpha", "Lowercase alpha should sort before later uppercase public targets");
    assert.strictEqual(makeLabels.at(-1), "_coverage_check", "Private Make target should sort after public targets");
    assert.strictEqual(
      makeLabels.filter((label) => label.startsWith(PRIVATE_RULE_PREFIX)).length,
      1,
      "Private Make rules should remain visible as commands, not separators or placeholders"
    );
    assert.strictEqual(privateRule.resourceUri?.scheme, "commandtree-private", "Private Make row should stay muted");
    assert.strictEqual(alpha.command?.command, "vscode.open", "Clicking a Make target should open its file");
    await clickTreeItem(alpha);
    assertActiveEditorEndsWith(MAKEFILE_PATH);
    assertCursorMatchesTaskLine(alpha);
    await clickTreeItem(privateRule);
    assertActiveEditorEndsWith(MAKEFILE_PATH);
    assertCursorMatchesTaskLine(privateRule);
  });

  test("configured name sort is applied to Make targets, npm scripts, and shell scripts", async function () {
    this.timeout(15000);
    await vscode.commands.executeCommand("commandtree.clearFilter");
    await updateSortOrder("name");
    await refreshTasks();

    const makeItems = await getFolderChildren("Make Targets", SORT_ORDER_FOLDER);
    const npmItems = await getFolderChildren("NPM Scripts", SORT_ORDER_FOLDER);
    const shellItems = await getFolderChildren("Shell Scripts", SORT_ORDER_FOLDER);
    const makeLabels = labelsOf(makeItems);
    const npmLabels = labelsOf(npmItems);
    const shellLabels = labelsOf(shellItems);

    assertAllCommands(makeItems);
    assertAllCommands(npmItems);
    assertAllCommands(shellItems);
    assert.deepStrictEqual(
      makeLabels,
      ["alpha", "build", "COVERAGE_THRESHOLDS_FILE", "help", "UNAME", "zeta", "_coverage_check"],
      "Make targets must use configured name sort and must not render a placeholder or divider row"
    );
    assert.deepStrictEqual(npmLabels, ["alpha", "Beta", "middle", "zeta"], "NPM scripts must use name sort");
    assert.deepStrictEqual(shellLabels, ["alpha.sh", "zeta.sh"], "Shell scripts must use name sort");
    assert.strictEqual(
      commandItemWithLabel(npmItems, "Beta").data.command,
      "npm run Beta",
      "NPM command should survive sorting"
    );
    assert.strictEqual(
      commandItemWithLabel(shellItems, "alpha.sh").data.filePath.endsWith(ALPHA_SHELL_PATH),
      true,
      "Shell command should point at the sorted fixture script"
    );
    await clickTreeItem(commandItemWithLabel(npmItems, "Beta"));
    assertActiveEditorEndsWith(PACKAGE_JSON_PATH);
    await clickTreeItem(commandItemWithLabel(shellItems, "alpha.sh"));
    assertActiveEditorEndsWith(ALPHA_SHELL_PATH);
  });

  test("every visible provider subtree has sorted command siblings and no stray rows", async function () {
    this.timeout(20000);
    await vscode.commands.executeCommand("commandtree.clearFilter");
    await updateSortOrder("name");
    await refreshTasks();

    const roots = await getCommandTreeProvider().getChildren();
    const rootLabels = labelsOf(roots);
    assert.ok(
      rootLabels.some((label) => label.startsWith("Make Targets")),
      "Make category should be visible"
    );
    assert.ok(
      rootLabels.some((label) => label.startsWith("NPM Scripts")),
      "NPM category should be visible"
    );
    assert.ok(
      rootLabels.some((label) => label.startsWith("Shell Scripts")),
      "Shell category should be visible"
    );
    await assertWholeTreeHasNoStrayRowsAndSortedCommands();
    assert.deepStrictEqual(
      labelsOf(await getFolderChildren("Make Targets", SORT_ORDER_FOLDER)),
      ["alpha", "build", "COVERAGE_THRESHOLDS_FILE", "help", "UNAME", "zeta", "_coverage_check"],
      "Whole-tree scan should still leave the Make fixture in exact sorted order"
    );
  });
});
