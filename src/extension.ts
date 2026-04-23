import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import { CommandTreeProvider } from "./CommandTreeProvider";
import { isCommandItem } from "./models/TaskItem";
import type { CommandTreeItem, CommandItem } from "./models/TaskItem";
import type { Result } from "./models/Result";
import { err, ok } from "./models/Result";
import { TaskRunner } from "./runners/TaskRunner";
import { QuickTasksProvider } from "./QuickTasksProvider";
import { logger } from "./utils/logger";
import { initDb, disposeDb } from "./db/lifecycle";
import { forceSelectModel } from "./semantic/summariser";
import { syncTagsFromConfig } from "./tags/tagSync";
import { setupFileWatchers } from "./watchers";
import { PrivateTaskDecorationProvider } from "./tree/PrivateTaskDecorationProvider";
import { appState } from "./state";
import {
  initAiSummaries,
  registerDiscoveredCommands,
  runSummarisation,
  syncAndSummarise,
} from "./summaryOrchestration";
import type { SummaryDeps } from "./summaryOrchestration";

const MAKE_EXECUTABLE_COMMAND = "commandtree.makeExecutable";
const EXECUTE_PERMISSION_BITS = 0o111;
const WINDOWS_PLATFORM = "win32";

export interface ExtensionExports {
  commandTreeProvider: CommandTreeProvider;
  quickTasksProvider: QuickTasksProvider;
}

function getTreeProvider(): CommandTreeProvider {
  if (appState.treeProvider === undefined) {
    throw new Error("CommandTree extension not activated");
  }
  return appState.treeProvider;
}

function getQuickTasksProvider(): QuickTasksProvider {
  if (appState.quickTasksProvider === undefined) {
    throw new Error("CommandTree extension not activated");
  }
  return appState.quickTasksProvider;
}

function getTaskRunner(): TaskRunner {
  if (appState.taskRunner === undefined) {
    throw new Error("CommandTree extension not activated");
  }
  return appState.taskRunner;
}

function getSummaryDeps(workspaceRoot: string): SummaryDeps {
  return {
    workspaceRoot,
    treeProvider: getTreeProvider(),
    quickTasksProvider: getQuickTasksProvider(),
  };
}

export async function activate(context: vscode.ExtensionContext): Promise<ExtensionExports | undefined> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  logger.info("Extension activating", { workspaceRoot });
  if (workspaceRoot === undefined) {
    logger.warn("No workspace root found, extension not activating");
    return undefined;
  }
  if (appState.activated && appState.treeProvider !== undefined && appState.quickTasksProvider !== undefined) {
    logger.info("Extension already activated; reusing existing state");
    return { commandTreeProvider: appState.treeProvider, quickTasksProvider: appState.quickTasksProvider };
  }
  appState.treeProvider = new CommandTreeProvider(workspaceRoot);
  appState.quickTasksProvider = new QuickTasksProvider();
  appState.taskRunner = new TaskRunner();
  appState.activated = true;
  context.subscriptions.push({ dispose: deactivate });
  registerTreeViews(context);
  registerCommands(context);
  setupWatchers(context, workspaceRoot);
  await initDatabaseSafe(workspaceRoot);
  runBackgroundStartup(workspaceRoot);
  logger.info("Extension activation complete");
  return { commandTreeProvider: appState.treeProvider, quickTasksProvider: appState.quickTasksProvider };
}

function runBackgroundStartup(workspaceRoot: string): void {
  initialDiscovery(workspaceRoot)
    .then(() => {
      initAiSummaries(getSummaryDeps(workspaceRoot));
    })
    .catch((e: unknown) => {
      logger.error("Initial discovery failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    });
}

async function initDatabaseSafe(workspaceRoot: string): Promise<void> {
  const result = await initDb(workspaceRoot);
  if (!result.ok) {
    logger.error("Database init returned error", { error: result.error });
  }
}

function setupWatchers(context: vscode.ExtensionContext, workspaceRoot: string): void {
  setupFileWatchers({
    context,
    onTaskFileChange: () => {
      syncAndSummarise(getSummaryDeps(workspaceRoot)).catch((e: unknown) => {
        logger.error("Sync failed", {
          error: e instanceof Error ? e.message : "Unknown",
        });
      });
    },
    onConfigChange: () => {
      syncTagsFromJson(workspaceRoot).catch((e: unknown) => {
        logger.error("Config sync failed", {
          error: e instanceof Error ? e.message : "Unknown",
        });
      });
    },
  });
}

async function initialDiscovery(workspaceRoot: string): Promise<void> {
  await syncQuickTasks();
  logger.info("syncQuickTasks complete", { taskCount: getTreeProvider().getAllTasks().length });
  await registerDiscoveredCommands(getSummaryDeps(workspaceRoot));
  await syncTagsFromJson(workspaceRoot);
}

function registerTreeViews(context: vscode.ExtensionContext): void {
  const tp = getTreeProvider();
  const qp = getQuickTasksProvider();
  context.subscriptions.push(
    vscode.window.createTreeView("commandtree", {
      treeDataProvider: tp,
      showCollapseAll: true,
      dragAndDropController: tp,
    }),
    vscode.window.createTreeView("commandtree-quick", {
      treeDataProvider: qp,
      showCollapseAll: true,
      dragAndDropController: qp,
    }),
    vscode.window.registerFileDecorationProvider(new PrivateTaskDecorationProvider())
  );
}

function registerCommands(context: vscode.ExtensionContext): void {
  registerCoreCommands(context);
  registerClipboardCommands(context);
  registerFileCommands(context);
  registerFilterCommands(context);
  registerTagCommands(context);
  registerQuickCommands(context);
}

function registerCoreCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("commandtree.refresh", async () => {
      await getTreeProvider().refresh();
      getQuickTasksProvider().updateTasks(getTreeProvider().getAllTasks());
      vscode.window.showInformationMessage("CommandTree refreshed");
    }),
    vscode.commands.registerCommand("commandtree.run", async (item: CommandTreeItem | undefined) => {
      if (item !== undefined && isCommandItem(item.data)) {
        await getTaskRunner().run(item.data, "newTerminal");
      }
    }),
    vscode.commands.registerCommand("commandtree.runInCurrentTerminal", async (item: CommandTreeItem | undefined) => {
      if (item !== undefined && isCommandItem(item.data)) {
        await getTaskRunner().run(item.data, "currentTerminal");
      }
    }),
    vscode.commands.registerCommand("commandtree.openPreview", async (item: CommandTreeItem | undefined) => {
      if (item !== undefined && isCommandItem(item.data) && item.data.type === "markdown") {
        await vscode.commands.executeCommand("markdown.showPreview", vscode.Uri.file(item.data.filePath));
      }
    })
  );
}

function registerClipboardCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("commandtree.copyRelativePath", handleCopyRelativePath),
    vscode.commands.registerCommand("commandtree.copyFullPath", handleCopyFullPath)
  );
}

function registerFileCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(vscode.commands.registerCommand(MAKE_EXECUTABLE_COMMAND, handleMakeExecutable));
}

function registerFilterCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("commandtree.filterByTag", handleFilterByTag),
    vscode.commands.registerCommand("commandtree.clearFilter", () => {
      getTreeProvider().clearFilters();
      updateFilterContext();
    }),
    vscode.commands.registerCommand("commandtree.generateSummaries", async () => {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (workspaceRoot !== undefined) {
        await runSummarisation(getSummaryDeps(workspaceRoot));
      }
    }),
    vscode.commands.registerCommand("commandtree.selectModel", async () => {
      const result = await forceSelectModel();
      if (result.ok) {
        vscode.window.showInformationMessage(`CommandTree: AI model set to ${result.value}`);
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot !== undefined) {
          await runSummarisation(getSummaryDeps(workspaceRoot));
        }
      } else {
        vscode.window.showWarningMessage(`CommandTree: ${result.error}`);
      }
    })
  );
}

function registerTagCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("commandtree.addTag", handleAddTag),
    vscode.commands.registerCommand("commandtree.removeTag", handleRemoveTag)
  );
}

function registerQuickCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "commandtree.addToQuick",
      async (item: CommandTreeItem | CommandItem | undefined) => {
        const task = extractTask(item);
        if (task !== undefined) {
          getQuickTasksProvider().addToQuick(task);
          await getTreeProvider().refresh();
          getQuickTasksProvider().updateTasks(getTreeProvider().getAllTasks());
        }
      }
    ),
    vscode.commands.registerCommand(
      "commandtree.removeFromQuick",
      async (item: CommandTreeItem | CommandItem | undefined) => {
        const task = extractTask(item);
        if (task !== undefined) {
          getQuickTasksProvider().removeFromQuick(task);
          await getTreeProvider().refresh();
          getQuickTasksProvider().updateTasks(getTreeProvider().getAllTasks());
        }
      }
    ),
    vscode.commands.registerCommand("commandtree.refreshQuick", () => {
      getQuickTasksProvider().refresh();
    })
  );
}

async function handleFilterByTag(): Promise<void> {
  const tags = getTreeProvider().getAllTags();
  if (tags.length === 0) {
    await vscode.window.showInformationMessage("No tags defined. Right-click commands to add tags.");
    return;
  }
  const items = [
    { label: "$(close) Clear tag filter", tag: null },
    ...tags.map((t) => ({ label: `$(tag) ${t}`, tag: t })),
  ];
  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: "Select tag to filter by",
  });
  if (selected) {
    getTreeProvider().setTagFilter(selected.tag);
    updateFilterContext();
  }
}

function extractTask(item: CommandTreeItem | CommandItem | undefined): CommandItem | undefined {
  if (item === undefined) {
    return undefined;
  }
  if ("data" in item) {
    return isCommandItem(item.data) ? item.data : undefined;
  }
  return item;
}

async function handleCopyRelativePath(item: CommandTreeItem | CommandItem | undefined): Promise<void> {
  const task = extractTask(item);
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (task === undefined || workspaceRoot === undefined) {
    return;
  }
  await vscode.env.clipboard.writeText(path.relative(workspaceRoot, task.filePath));
}

async function handleCopyFullPath(item: CommandTreeItem | CommandItem | undefined): Promise<void> {
  const task = extractTask(item);
  if (task === undefined) {
    return;
  }
  await vscode.env.clipboard.writeText(task.filePath);
}

async function handleMakeExecutable(item: CommandTreeItem | CommandItem | undefined): Promise<void> {
  const task = extractTask(item);
  if (task === undefined || process.platform === WINDOWS_PLATFORM) {
    return;
  }
  const result = await makeFileExecutable(task.filePath);
  if (!result.ok) {
    logger.error("Make executable failed", { error: result.error });
    vscode.window.showErrorMessage(`CommandTree: ${result.error}`);
    return;
  }
  vscode.window.showInformationMessage(`CommandTree: Made ${path.basename(task.filePath)} executable`);
}

async function makeFileExecutable(filePath: string): Promise<Result<void, string>> {
  try {
    const stat = await fs.stat(filePath);
    await fs.chmod(filePath, stat.mode | EXECUTE_PERMISSION_BITS);
    return ok(undefined);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : "Unable to change file permissions");
  }
}

async function handleAddTag(item: CommandTreeItem | CommandItem | undefined, tagNameArg?: string): Promise<void> {
  const task = extractTask(item);
  if (task === undefined) {
    return;
  }
  const tagName = tagNameArg ?? (await pickOrCreateTag(getTreeProvider().getAllTags(), task.label));
  if (tagName === undefined || tagName === "") {
    return;
  }
  await getTreeProvider().addTaskToTag(task, tagName);
  getQuickTasksProvider().updateTasks(getTreeProvider().getAllTasks());
}

async function handleRemoveTag(item: CommandTreeItem | CommandItem | undefined, tagNameArg?: string): Promise<void> {
  const task = extractTask(item);
  if (task === undefined) {
    return;
  }
  if (task.tags.length === 0 && tagNameArg === undefined) {
    vscode.window.showInformationMessage("This command has no tags");
    return;
  }
  let tagToRemove = tagNameArg;
  if (tagToRemove === undefined) {
    const options = task.tags.map((t) => ({ label: `$(tag) ${t}`, tag: t }));
    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: `Remove tag from "${task.label}"`,
    });
    if (selected === undefined) {
      return;
    }
    tagToRemove = selected.tag;
  }
  await getTreeProvider().removeTaskFromTag(task, tagToRemove);
  getQuickTasksProvider().updateTasks(getTreeProvider().getAllTasks());
}

async function syncQuickTasks(): Promise<void> {
  await getTreeProvider().refresh();
  const allTasks = getTreeProvider().getAllTasks();
  getQuickTasksProvider().updateTasks(allTasks);
}

async function syncTagsFromJson(workspaceRoot: string): Promise<void> {
  const allTasks = getTreeProvider().getAllTasks();
  const synced = syncTagsFromConfig({ allTasks, workspaceRoot });
  if (synced) {
    await getTreeProvider().refresh();
    getQuickTasksProvider().updateTasks(getTreeProvider().getAllTasks());
  }
}

async function pickOrCreateTag(existingTags: string[], taskLabel: string): Promise<string | undefined> {
  return await new Promise<string | undefined>((resolve) => {
    const qp = vscode.window.createQuickPick();
    qp.placeholder = `Type new tag or select existing — "${taskLabel}"`;
    qp.items = existingTags.map((t) => ({ label: t }));
    let resolved = false;
    const finish = (value: string | undefined): void => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve(value);
      qp.dispose();
    };
    qp.onDidAccept(() => {
      const selected = qp.selectedItems[0];
      const value = selected?.label ?? qp.value.trim();
      finish(value !== "" ? value : undefined);
    });
    qp.onDidHide(() => {
      finish(undefined);
    });
    qp.show();
  });
}

function updateFilterContext(): void {
  vscode.commands.executeCommand("setContext", "commandtree.hasFilter", getTreeProvider().hasFilter());
}

export function deactivate(): void {
  disposeDb();
  appState.reset();
}
