import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import {
  activateExtension,
  deleteFile,
  getFixturePath,
  getQuickTasksProvider,
  getCommandTreeProvider,
  writeFile,
} from "../helpers/helpers";
import type { QuickTasksProvider } from "../helpers/helpers";
import { getDbOrThrow, initDb } from "../../db/lifecycle";
import { getCommandIdsByTag } from "../../db/db";
import { createCommandNode } from "../../tree/nodeFactory";
import { isCommandItem } from "../../models/TaskItem";
import type { CommandItem, CommandTreeItem } from "../../models/TaskItem";
import { readFile, readFileContent, readJsonFile, parseFirstLineComment } from "../../utils/fileUtils";
import { logger } from "../../utils/logger";
import { PrivateTaskDecorationProvider, buildPrivateTaskUri } from "../../tree/PrivateTaskDecorationProvider";
import { discoverCsharpScripts } from "../../discovery/csharp-script";
import { discoverFsharpScripts } from "../../discovery/fsharp-script";

const QUICK_TAG = "quick";
const QUICK_MIME = "application/vnd.commandtree.quicktask";
const JSONC_PATH = "coverage-fixtures/config.jsonc";
const BAD_JSON_PATH = "coverage-fixtures/bad.jsonc";
const CSHARP_PATH = "coverage-fixtures/example.csx";
const FSHARP_PATH = "coverage-fixtures/example.fsx";

function commandIds(): string[] {
  return getCommandIdsByTag({ handle: getDbOrThrow(), tagName: QUICK_TAG });
}

async function addQuickTask(item: vscode.TreeItem): Promise<void> {
  await vscode.commands.executeCommand("commandtree.addToQuick", item);
}

async function removeQuickTask(item: vscode.TreeItem): Promise<void> {
  await vscode.commands.executeCommand("commandtree.removeFromQuick", item);
}

interface QuickCoverageState {
  readonly quickProvider: QuickTasksProvider;
  readonly tasks: readonly [CommandItem, CommandItem, CommandItem];
  readonly nodes: readonly CommandTreeItem[];
  readonly initialIds: readonly string[];
}

interface SameTargetParams {
  readonly quickProvider: QuickTasksProvider;
  readonly source: CommandTreeItem;
  readonly task: CommandItem;
  readonly initialIds: readonly string[];
}

interface ReorderBeforeParams {
  readonly quickProvider: QuickTasksProvider;
  readonly dragged: CommandTreeItem;
  readonly target: CommandTreeItem;
  readonly draggedTask: CommandItem;
  readonly targetTask: CommandItem;
}

function firstThreeTasks(tasks: readonly CommandItem[]): [CommandItem, CommandItem, CommandItem] {
  const first = tasks[0];
  const second = tasks[1];
  const third = tasks[2];
  if (first === undefined || second === undefined || third === undefined) {
    assert.fail("Need three discovered tasks for drag/drop coverage");
  }
  return [first, second, third];
}

function assertQuickTasksPresent(tasks: readonly CommandItem[], ids: readonly string[]): void {
  for (const task of tasks) {
    assert.ok(ids.includes(task.id), `Quick list should contain ${task.label}`);
  }
}

async function setupQuickCoverage(): Promise<QuickCoverageState> {
  const quickProvider = getQuickTasksProvider();
  const tasks = firstThreeTasks(getCommandTreeProvider().getAllTasks());
  const nodes = tasks.map((task) => createCommandNode(task));
  for (const node of nodes) {
    await addQuickTask(node);
  }
  const initialIds = commandIds();
  assertQuickTasksPresent(tasks, initialIds);
  return { quickProvider, tasks, nodes, initialIds };
}

function assertEmptyAndInvalidDrops(quickProvider: QuickTasksProvider, initialIds: readonly string[]): void {
  const emptyDrag = new vscode.DataTransfer();
  quickProvider.handleDrag([], emptyDrag);
  assert.strictEqual(emptyDrag.get(QUICK_MIME), undefined, "Empty drag source should not set transfer data");
  const invalidDrop = new vscode.DataTransfer();
  quickProvider.handleDrop(undefined, invalidDrop);
  assert.deepStrictEqual(commandIds(), initialIds, "Drop without transfer data should not reorder");
}

function visibleQuickItems(quickProvider: QuickTasksProvider): CommandTreeItem[] {
  const quickItems = quickProvider.getChildren().filter((item) => isCommandItem(item.data));
  assert.ok(quickItems.length >= 3, "Quick provider should expose command rows");
  return quickItems;
}

function commandItemForTask(items: readonly CommandTreeItem[], task: CommandItem): CommandTreeItem {
  const item = items.find((candidate) => isCommandItem(candidate.data) && candidate.data.id === task.id);
  if (item === undefined) {
    assert.fail(`Quick provider should expose ${task.label}`);
  }
  return item;
}

function assertSameTargetDoesNotReorder({ quickProvider, source, task, initialIds }: SameTargetParams): void {
  const sameTargetDrag = new vscode.DataTransfer();
  quickProvider.handleDrag([source], sameTargetDrag);
  assert.strictEqual(sameTargetDrag.get(QUICK_MIME)?.value, task.id, "Drag should carry task ID");
  quickProvider.handleDrop(source, sameTargetDrag);
  assert.deepStrictEqual(commandIds(), initialIds, "Dropping onto itself should not reorder");
}

function assertReorderBefore({ quickProvider, dragged, target, draggedTask, targetTask }: ReorderBeforeParams): void {
  const reorderDrag = new vscode.DataTransfer();
  quickProvider.handleDrag([dragged], reorderDrag);
  quickProvider.handleDrop(target, reorderDrag);
  const reordered = commandIds();
  const targetIndex = reordered.indexOf(targetTask.id);
  const draggedIndex = reordered.indexOf(draggedTask.id);
  assert.ok(draggedIndex !== -1 && targetIndex !== -1, "Dragged and target tasks should stay in quick list");
  assert.ok(draggedIndex < targetIndex, "Dragged item should move before the target item");
}

function assertDropToEnd(quickProvider: QuickTasksProvider, source: CommandTreeItem, task: CommandItem): void {
  const dropToEnd = new vscode.DataTransfer();
  quickProvider.handleDrag([source], dropToEnd);
  quickProvider.handleDrop(undefined, dropToEnd);
  const endOrder = commandIds();
  assert.strictEqual(endOrder.at(-1), task.id, "Dropping with no target should move item to the end");
}

async function cleanupQuickNodes(nodes: readonly CommandTreeItem[]): Promise<void> {
  for (const node of nodes) {
    await removeQuickTask(node);
  }
}

suite("Coverage E2E Tests", () => {
  let workspaceRoot = "";

  suiteSetup(async function () {
    this.timeout(30000);
    ({ workspaceRoot } = await activateExtension());
    const dbResult = await initDb(workspaceRoot);
    assert.ok(dbResult.ok, "Coverage tests should have an initialized database");
  });

  teardown(() => {
    deleteFile(JSONC_PATH);
    deleteFile(BAD_JSON_PATH);
    deleteFile(CSHARP_PATH);
    deleteFile(FSHARP_PATH);
  });

  test("filesystem helpers, logger, and private decorations cover success and error paths", async function () {
    this.timeout(15000);
    writeFile(JSONC_PATH, ['{', '  // removed', '  "name": "coverage",', '  "enabled": true', '}'].join("\n"));
    writeFile(BAD_JSON_PATH, '{ "name": ');
    const validUri = vscode.Uri.file(getFixturePath(JSONC_PATH));
    const badUri = vscode.Uri.file(getFixturePath(BAD_JSON_PATH));
    const missingUri = vscode.Uri.file(getFixturePath("coverage-fixtures/missing.json"));

    const readResult = await readFile(validUri);
    assert.ok(readResult.ok, "readFile should return ok for an existing file");
    assert.ok(readResult.value.includes("coverage"), "readFile should decode file contents");
    assert.strictEqual(await readFileContent(validUri), readResult.value, "readFileContent should return raw text");

    const parsed = await readJsonFile<{ name: string; enabled: boolean }>(validUri);
    assert.ok(parsed.ok, "readJsonFile should parse JSONC after stripping comments");
    assert.strictEqual(parsed.value.name, "coverage", "Parsed JSONC should expose string values");
    assert.strictEqual(parsed.value.enabled, true, "Parsed JSONC should expose boolean values");

    const badJson = await readJsonFile<unknown>(badUri);
    assert.ok(!badJson.ok, "readJsonFile should return err for malformed JSON");
    assert.ok(badJson.error.length > 0, "Malformed JSON error should include a message");
    const missing = await readJsonFile<unknown>(missingUri);
    assert.ok(!missing.ok, "readJsonFile should return err for missing files");
    assert.ok(missing.error.length > 0, "Missing file error should include a message");

    assert.strictEqual(parseFirstLineComment("\n\n// Hello\ncode", "//"), "Hello", "Should skip blank lines");
    assert.strictEqual(parseFirstLineComment("//\ncode", "//"), undefined, "Empty comments should be ignored");
    assert.strictEqual(parseFirstLineComment("code\n// later", "//"), undefined, "Later comments should not count");

    logger.show();
    logger.info("coverage info");
    logger.info("coverage info data", { count: 1 });
    logger.warn("coverage warn");
    logger.warn("coverage warn data", { count: 2 });
    logger.error("coverage error");
    logger.error("coverage error data", { count: 3 });
    logger.filter("coverage", { active: true });

    const decorations = new PrivateTaskDecorationProvider();
    const privateDecoration = decorations.provideFileDecoration(buildPrivateTaskUri("coverage-task"));
    assert.ok(privateDecoration !== undefined, "Private task URI should produce a decoration");
    assert.strictEqual(privateDecoration.color?.id, "descriptionForeground", "Private decoration should be muted");
    assert.strictEqual(privateDecoration.tooltip, "Private task", "Private decoration should identify private tasks");
    assert.strictEqual(decorations.provideFileDecoration(validUri), undefined, "Normal file URI should not be decorated");
  });

  test("C# and F# script discovery covers described and executable script rows", async function () {
    this.timeout(15000);
    writeFile(CSHARP_PATH, ["// C# script description", 'Console.WriteLine("hello");'].join("\n"));
    writeFile(FSHARP_PATH, ["// F# script description", 'printfn "hello"'].join("\n"));

    const csharp = await discoverCsharpScripts(workspaceRoot, []);
    const fsharp = await discoverFsharpScripts(workspaceRoot, []);
    const csItem = csharp.find((task) => task.filePath.endsWith(CSHARP_PATH));
    const fsItem = fsharp.find((task) => task.filePath.endsWith(FSHARP_PATH));

    assert.ok(csItem !== undefined, "C# script should be discovered");
    assert.strictEqual(csItem.label, "example.csx", "C# script label should be the file name");
    assert.strictEqual(csItem.description, "C# script description", "C# description should come from first comment");
    assert.ok(csItem.command.startsWith("dotnet script"), "C# command should use dotnet script");
    assert.strictEqual(csItem.cwd, path.dirname(csItem.filePath), "C# cwd should be script directory");

    assert.ok(fsItem !== undefined, "F# script should be discovered");
    assert.strictEqual(fsItem.label, "example.fsx", "F# script label should be the file name");
    assert.strictEqual(fsItem.description, "F# script description", "F# description should come from first comment");
    assert.ok(fsItem.command.startsWith("dotnet fsi"), "F# command should use dotnet fsi");
    assert.strictEqual(fsItem.cwd, path.dirname(fsItem.filePath), "F# cwd should be script directory");
  });

  test("Quick Launch drag and drop covers empty, invalid, same-target, and reorder interactions", async function () {
    this.timeout(30000);
    const context = await setupQuickCoverage();

    try {
      assertEmptyAndInvalidDrops(context.quickProvider, context.initialIds);
      const [firstTask, , thirdTask] = context.tasks;
      const quickItems = visibleQuickItems(context.quickProvider);
      const first = commandItemForTask(quickItems, firstTask);
      const third = commandItemForTask(quickItems, thirdTask);
      assertSameTargetDoesNotReorder({
        quickProvider: context.quickProvider,
        source: first,
        task: firstTask,
        initialIds: context.initialIds,
      });
      assertReorderBefore({
        quickProvider: context.quickProvider,
        dragged: third,
        target: first,
        draggedTask: thirdTask,
        targetTask: firstTask,
      });
      assertDropToEnd(context.quickProvider, first, firstTask);
    } finally {
      await cleanupQuickNodes(context.nodes);
    }
  });
});
