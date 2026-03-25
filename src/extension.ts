import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { CommandTreeProvider } from "./CommandTreeProvider";
import { CommandTreeItem, isCommandItem } from "./models/TaskItem";
import type { CommandItem } from "./models/TaskItem";
import { TaskRunner } from "./runners/TaskRunner";
import { QuickTasksProvider } from "./QuickTasksProvider";
import { logger } from "./utils/logger";
import type { DbHandle } from "./db/db";
import { initDb, getDb, disposeDb } from "./db/lifecycle";
import { addTagToCommand, removeTagFromCommand, getCommandIdsByTag } from "./db/db";
import { summariseAllTasks, registerAllCommands } from "./semantic/summaryPipeline";
import { createVSCodeFileSystem } from "./semantic/vscodeAdapters";
import { forceSelectModel } from "./semantic/summariser";

let treeProvider: CommandTreeProvider;
let quickTasksProvider: QuickTasksProvider;
let taskRunner: TaskRunner;

export interface ExtensionExports {
  commandTreeProvider: CommandTreeProvider;
  quickTasksProvider: QuickTasksProvider;
}

export async function activate(context: vscode.ExtensionContext): Promise<ExtensionExports | undefined> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  logger.info("Extension activating", { workspaceRoot });
  if (workspaceRoot === undefined || workspaceRoot === "") {
    logger.warn("No workspace root found, extension not activating");
    return;
  }
  initDatabase(workspaceRoot);
  treeProvider = new CommandTreeProvider(workspaceRoot);
  quickTasksProvider = new QuickTasksProvider();
  taskRunner = new TaskRunner();
  registerTreeViews(context);
  registerCommands(context);
  setupFileWatcher(context, workspaceRoot);
  await syncQuickTasks();
  await registerDiscoveredCommands(workspaceRoot);
  await syncTagsFromJson(workspaceRoot);
  initAiSummaries(workspaceRoot);
  return { commandTreeProvider: treeProvider, quickTasksProvider };
}

function initDatabase(workspaceRoot: string): void {
  const result = initDb(workspaceRoot);
  if (!result.ok) {
    logger.warn("SQLite init failed", { error: result.error });
  }
}

function registerTreeViews(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.createTreeView("commandtree", {
      treeDataProvider: treeProvider,
      showCollapseAll: true,
    }),
    vscode.window.createTreeView("commandtree-quick", {
      treeDataProvider: quickTasksProvider,
      showCollapseAll: true,
      dragAndDropController: quickTasksProvider,
    })
  );
}

function registerCommands(context: vscode.ExtensionContext): void {
  registerCoreCommands(context);
  registerFilterCommands(context);
  registerTagCommands(context);
  registerQuickCommands(context);
}

function registerCoreCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("commandtree.refresh", async () => {
      await treeProvider.refresh();
      quickTasksProvider.updateTasks(treeProvider.getAllTasks());
      vscode.window.showInformationMessage("CommandTree refreshed");
    }),
    vscode.commands.registerCommand("commandtree.run", async (item: CommandTreeItem | undefined) => {
      if (item !== undefined && isCommandItem(item.data)) {
        await taskRunner.run(item.data, "newTerminal");
      }
    }),
    vscode.commands.registerCommand("commandtree.runInCurrentTerminal", async (item: CommandTreeItem | undefined) => {
      if (item !== undefined && isCommandItem(item.data)) {
        await taskRunner.run(item.data, "currentTerminal");
      }
    }),
    vscode.commands.registerCommand("commandtree.openPreview", async (item: CommandTreeItem | undefined) => {
      if (item !== undefined && isCommandItem(item.data) && item.data.type === "markdown") {
        await vscode.commands.executeCommand("markdown.showPreview", vscode.Uri.file(item.data.filePath));
      }
    })
  );
}

function registerFilterCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("commandtree.filterByTag", handleFilterByTag),
    vscode.commands.registerCommand("commandtree.clearFilter", () => {
      treeProvider.clearFilters();
      updateFilterContext();
    }),
    vscode.commands.registerCommand("commandtree.generateSummaries", async () => {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (workspaceRoot !== undefined) {
        await runSummarisation(workspaceRoot);
      }
    }),
    vscode.commands.registerCommand("commandtree.selectModel", async () => {
      const result = await forceSelectModel();
      if (result.ok) {
        vscode.window.showInformationMessage(`CommandTree: AI model set to ${result.value}`);
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot !== undefined) {
          await runSummarisation(workspaceRoot);
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
          quickTasksProvider.addToQuick(task);
          await treeProvider.refresh();
          quickTasksProvider.updateTasks(treeProvider.getAllTasks());
        }
      }
    ),
    vscode.commands.registerCommand(
      "commandtree.removeFromQuick",
      async (item: CommandTreeItem | CommandItem | undefined) => {
        const task = extractTask(item);
        if (task !== undefined) {
          quickTasksProvider.removeFromQuick(task);
          await treeProvider.refresh();
          quickTasksProvider.updateTasks(treeProvider.getAllTasks());
        }
      }
    ),
    vscode.commands.registerCommand("commandtree.refreshQuick", () => {
      quickTasksProvider.refresh();
    })
  );
}

async function handleFilterByTag(): Promise<void> {
  const tags = treeProvider.getAllTags();
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
    treeProvider.setTagFilter(selected.tag);
    updateFilterContext();
  }
}

function extractTask(item: CommandTreeItem | CommandItem | undefined): CommandItem | undefined {
  if (item === undefined) {
    return undefined;
  }
  if (item instanceof CommandTreeItem) {
    return isCommandItem(item.data) ? item.data : undefined;
  }
  return item;
}

async function handleAddTag(item: CommandTreeItem | CommandItem | undefined, tagNameArg?: string): Promise<void> {
  const task = extractTask(item);
  if (task === undefined) {
    return;
  }
  const tagName = tagNameArg ?? (await pickOrCreateTag(treeProvider.getAllTags(), task.label));
  if (tagName === undefined || tagName === "") {
    return;
  }
  await treeProvider.addTaskToTag(task, tagName);
  quickTasksProvider.updateTasks(treeProvider.getAllTasks());
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
  await treeProvider.removeTaskFromTag(task, tagToRemove);
  quickTasksProvider.updateTasks(treeProvider.getAllTasks());
}

function setupFileWatcher(context: vscode.ExtensionContext, workspaceRoot: string): void {
  const watcher = vscode.workspace.createFileSystemWatcher(
    "**/{package.json,Makefile,makefile,tasks.json,launch.json,*.sh,*.py}"
  );
  let debounceTimer: NodeJS.Timeout | undefined;
  const onFileChange = (): void => {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      syncAndSummarise(workspaceRoot).catch((e: unknown) => {
        logger.error("Sync failed", {
          error: e instanceof Error ? e.message : "Unknown",
        });
      });
    }, 2000);
  };
  watcher.onDidChange(onFileChange);
  watcher.onDidCreate(onFileChange);
  watcher.onDidDelete(onFileChange);
  context.subscriptions.push(watcher);

  const configWatcher = vscode.workspace.createFileSystemWatcher("**/.vscode/commandtree.json");
  let configDebounceTimer: NodeJS.Timeout | undefined;
  const onConfigChange = (): void => {
    if (configDebounceTimer !== undefined) {
      clearTimeout(configDebounceTimer);
    }
    configDebounceTimer = setTimeout(() => {
      syncTagsFromJson(workspaceRoot).catch((e: unknown) => {
        logger.error("Config sync failed", {
          error: e instanceof Error ? e.message : "Unknown",
        });
      });
    }, 1000);
  };
  configWatcher.onDidChange(onConfigChange);
  configWatcher.onDidCreate(onConfigChange);
  configWatcher.onDidDelete(onConfigChange);
  context.subscriptions.push(configWatcher);
}

async function syncQuickTasks(): Promise<void> {
  await treeProvider.refresh();
  const allTasks = treeProvider.getAllTasks();
  quickTasksProvider.updateTasks(allTasks);
}

interface TagPattern {
  readonly id?: string;
  readonly type?: string;
  readonly label?: string;
}

function matchesPattern(task: CommandItem, pattern: string | TagPattern): boolean {
  if (typeof pattern === "string") {
    return task.id === pattern;
  }
  if (pattern.type !== undefined && task.type !== pattern.type) {
    return false;
  }
  if (pattern.label !== undefined && task.label !== pattern.label) {
    return false;
  }
  if (pattern.id !== undefined && task.id !== pattern.id) {
    return false;
  }
  return true;
}

interface TagConfig {
  readonly tags?: Record<string, Array<string | TagPattern>>;
}

function collectMatchedIds(
  patterns: ReadonlyArray<string | TagPattern>,
  allTasks: readonly CommandItem[]
): Set<string> {
  const matched = new Set<string>();
  for (const pattern of patterns) {
    for (const task of allTasks) {
      if (matchesPattern(task, pattern)) {
        matched.add(task.id);
      }
    }
  }
  return matched;
}

function syncTagDiff({
  handle,
  tagName,
  currentIds,
  matchedIds,
}: {
  readonly handle: DbHandle;
  readonly tagName: string;
  readonly currentIds: ReadonlySet<string>;
  readonly matchedIds: ReadonlySet<string>;
}): void {
  for (const id of currentIds) {
    if (!matchedIds.has(id)) {
      removeTagFromCommand({ handle, commandId: id, tagName });
    }
  }
  for (const id of matchedIds) {
    if (!currentIds.has(id)) {
      addTagToCommand({ handle, commandId: id, tagName });
    }
  }
}

function readTagConfig(configPath: string): TagConfig | undefined {
  if (!fs.existsSync(configPath)) {
    return undefined;
  }
  const content = fs.readFileSync(configPath, "utf8");
  return JSON.parse(content) as TagConfig;
}

async function syncTagsFromJson(workspaceRoot: string): Promise<void> {
  const configPath = path.join(workspaceRoot, ".vscode", "commandtree.json");
  const config = readTagConfig(configPath);
  if (config?.tags === undefined) {
    return;
  }
  const dbResult = getDb();
  if (!dbResult.ok) {
    logger.warn("DB not available, skipping tag sync", {
      error: dbResult.error,
    });
    return;
  }
  try {
    const allTasks = treeProvider.getAllTasks();
    for (const [tagName, patterns] of Object.entries(config.tags)) {
      const existingIds = getCommandIdsByTag({ handle: dbResult.value, tagName });
      const currentIds = existingIds.ok ? new Set(existingIds.value) : new Set<string>();
      const matchedIds = collectMatchedIds(patterns, allTasks);
      syncTagDiff({ handle: dbResult.value, tagName, currentIds, matchedIds });
    }
    await treeProvider.refresh();
    quickTasksProvider.updateTasks(treeProvider.getAllTasks());
    logger.info("Tag sync complete");
  } catch (e) {
    logger.error("Tag sync failed", {
      error: e instanceof Error ? e.message : "Unknown",
      stack: e instanceof Error ? e.stack : undefined,
    });
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

async function registerDiscoveredCommands(workspaceRoot: string): Promise<void> {
  const tasks = treeProvider.getAllTasks();
  if (tasks.length === 0) {
    return;
  }
  const result = await registerAllCommands({
    tasks,
    workspaceRoot,
    fs: createVSCodeFileSystem(),
  });
  if (!result.ok) {
    logger.warn("Command registration failed", { error: result.error });
  } else {
    logger.info("Commands registered in DB", { count: result.value });
  }
}

function initAiSummaries(workspaceRoot: string): void {
  const aiConfig = vscode.workspace.getConfiguration("commandtree").get<boolean>("enableAiSummaries");
  if (aiConfig === false) {
    return;
  }
  vscode.commands.executeCommand("setContext", "commandtree.aiSummariesEnabled", true);
  runSummarisation(workspaceRoot).catch((e: unknown) => {
    logger.error("AI summarisation failed", {
      error: e instanceof Error ? e.message : "Unknown",
    });
  });
}

async function runSummarisation(workspaceRoot: string): Promise<void> {
  const tasks = treeProvider.getAllTasks();
  logger.info("[SUMMARY] Starting", { taskCount: tasks.length });
  if (tasks.length === 0) {
    logger.warn("[SUMMARY] No tasks to summarise");
    return;
  }
  const summaryResult = await summariseAllTasks({
    tasks,
    workspaceRoot,
    fs: createVSCodeFileSystem(),
    onProgress: (done, total, label) => {
      logger.info(`[SUMMARY] ${label}`, { done, total });
    },
  });
  if (!summaryResult.ok) {
    logger.error("Summary pipeline failed", { error: summaryResult.error });
    vscode.window.showErrorMessage(`CommandTree: Summary failed — ${summaryResult.error}`);
    return;
  }
  if (summaryResult.value > 0) {
    await treeProvider.refresh();
    quickTasksProvider.updateTasks(treeProvider.getAllTasks());
  }
  vscode.window.showInformationMessage(`CommandTree: Summarised ${summaryResult.value} commands`);
}

async function syncAndSummarise(workspaceRoot: string): Promise<void> {
  await syncQuickTasks();
  await registerDiscoveredCommands(workspaceRoot);
  const aiConfig = vscode.workspace.getConfiguration("commandtree").get<boolean>("enableAiSummaries");
  if (aiConfig !== false) {
    await runSummarisation(workspaceRoot);
  }
}

function updateFilterContext(): void {
  vscode.commands.executeCommand("setContext", "commandtree.hasFilter", treeProvider.hasFilter());
}

export function deactivate(): void {
  disposeDb();
}
