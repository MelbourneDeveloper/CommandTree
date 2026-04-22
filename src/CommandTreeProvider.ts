import * as vscode from "vscode";
import { isCommandItem, isPrivateTask } from "./models/TaskItem";
import type { CommandItem, CategoryDef } from "./models/TaskItem";
import type { CommandTreeItem } from "./models/TaskItem";
import type { DiscoveryResult } from "./discovery";
import { discoverAllTasks, flattenTasks, getExcludePatterns, CATEGORY_DEFS } from "./discovery";
import { TagConfig } from "./config/TagConfig";
import { logger } from "./utils/logger";
import { buildNestedFolderItems } from "./tree/folderTree";
import { createCategoryNode, createTaskNodes } from "./tree/nodeFactory";
import { getAllRows } from "./db/db";
import type { CommandRow } from "./db/db";
import { getDbOrThrow } from "./db/lifecycle";

type SortOrder = "folder" | "name" | "type";
const SCRIPT_URI_LIST_MIME = "text/uri-list";
const SCRIPT_PLAIN_TEXT_MIME = "text/plain";
const SCRIPT_COMMAND_MIME = "application/vnd.commandtree.script";
const URI_LIST_SEPARATOR = "\r\n";
const PLAIN_TEXT_SEPARATOR = "\n";

function buildUriList(tasks: readonly CommandItem[]): string {
  return tasks.map((task) => vscode.Uri.file(task.filePath).toString()).join(URI_LIST_SEPARATOR);
}

function buildPlainPathList(tasks: readonly CommandItem[]): string {
  return tasks.map((task) => task.filePath).join(PLAIN_TEXT_SEPARATOR);
}

function buildCommandIdList(tasks: readonly CommandItem[]): string {
  return tasks.map((task) => task.id).join(PLAIN_TEXT_SEPARATOR);
}

/**
 * Tree data provider for CommandTree view.
 */
export class CommandTreeProvider
  implements vscode.TreeDataProvider<CommandTreeItem>, vscode.TreeDragAndDropController<CommandTreeItem>
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<CommandTreeItem | undefined>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  public readonly dropMimeTypes: readonly string[] = [];
  public readonly dragMimeTypes: readonly string[] = [
    SCRIPT_URI_LIST_MIME,
    SCRIPT_PLAIN_TEXT_MIME,
    SCRIPT_COMMAND_MIME,
  ];

  private commands: CommandItem[] = [];
  private discoveryResult: DiscoveryResult | null = null;
  private tagFilter: string | null = null;
  private summaries: ReadonlyMap<string, CommandRow> = new Map();
  private readonly tagConfig: TagConfig;
  private readonly workspaceRoot: string;
  private refreshPromise: Promise<void> | null = null;

  public constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.tagConfig = new TagConfig();
  }

  public async refresh(): Promise<void> {
    if (this.refreshPromise !== null) {
      logger.info("CommandTreeProvider.refresh() sharing in-flight refresh");
      await this.refreshPromise;
      return;
    }
    this.refreshPromise = this.runRefresh();
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async runRefresh(): Promise<void> {
    logger.info("CommandTreeProvider.refresh() starting");
    this.tagConfig.load();
    logger.info("Tag config loaded, getting exclude patterns");
    const excludePatterns = getExcludePatterns();
    logger.info("Exclude patterns", { excludePatterns });
    this.discoveryResult = await discoverAllTasks(this.workspaceRoot, excludePatterns);
    logger.info("Discovery result received, flattening tasks");
    this.commands = this.tagConfig.applyTags(flattenTasks(this.discoveryResult));
    logger.info("Tasks flattened and tagged", { count: this.commands.length });
    this.loadSummaries();
    this.commands = this.attachSummaries(this.commands);
    logger.info("Summaries attached, firing tree change event");
    this._onDidChangeTreeData.fire(undefined);
  }

  private loadSummaries(): void {
    const handle = getDbOrThrow();
    const rows = getAllRows(handle);
    const map = new Map<string, CommandRow>();
    for (const row of rows) {
      map.set(row.commandId, row);
    }
    this.summaries = map;
  }

  private attachSummaries(tasks: CommandItem[]): CommandItem[] {
    if (this.summaries.size === 0) {
      return tasks;
    }
    return tasks.map((task) => {
      const record = this.summaries.get(task.id);
      if (record === undefined) {
        return task;
      }
      const warning = record.securityWarning;
      return {
        ...task,
        summary: record.summary,
        ...(warning !== null ? { securityWarning: warning } : {}),
      };
    });
  }

  public setTagFilter(tag: string | null): void {
    logger.filter("setTagFilter", { tagFilter: tag });
    this.tagFilter = tag;
    this._onDidChangeTreeData.fire(undefined);
  }

  public clearFilters(): void {
    this.tagFilter = null;
    this._onDidChangeTreeData.fire(undefined);
  }

  public hasFilter(): boolean {
    return this.tagFilter !== null;
  }

  public getAllTags(): string[] {
    const tags = new Set<string>();
    for (const task of this.commands) {
      for (const tag of task.tags) {
        tags.add(tag);
      }
    }
    for (const tag of this.tagConfig.getTagNames()) {
      tags.add(tag);
    }
    return Array.from(tags).sort();
  }

  public async addTaskToTag(task: CommandItem, tagName: string): Promise<void> {
    this.tagConfig.addTaskToTag(task, tagName);
    await this.refresh();
  }

  public async removeTaskFromTag(task: CommandItem, tagName: string): Promise<void> {
    this.tagConfig.removeTaskFromTag(task, tagName);
    await this.refresh();
  }

  public getAllTasks(): CommandItem[] {
    return this.commands;
  }

  public getTreeItem(element: CommandTreeItem): vscode.TreeItem {
    return element;
  }

  public handleDrag(source: readonly CommandTreeItem[], dataTransfer: vscode.DataTransfer): void {
    const tasks = source.map((item) => item.data).filter(isCommandItem);
    if (tasks.length === 0) {
      return;
    }
    dataTransfer.set(SCRIPT_URI_LIST_MIME, new vscode.DataTransferItem(buildUriList(tasks)));
    dataTransfer.set(SCRIPT_PLAIN_TEXT_MIME, new vscode.DataTransferItem(buildPlainPathList(tasks)));
    dataTransfer.set(SCRIPT_COMMAND_MIME, new vscode.DataTransferItem(buildCommandIdList(tasks)));
  }

  public async getChildren(element?: CommandTreeItem): Promise<CommandTreeItem[]> {
    if (!this.discoveryResult) {
      logger.info("getChildren: no discovery result yet, triggering refresh");
      await this.refresh();
    }
    if (!element) {
      const roots = this.buildRootCategories();
      logger.info("getChildren: root categories built", { categoryCount: roots.length });
      return roots;
    }
    return element.children;
  }

  private buildRootCategories(): CommandTreeItem[] {
    const filtered = this.applyTagFilter(this.commands);
    return CATEGORY_DEFS.map((def) => this.buildCategoryIfNonEmpty(filtered, def)).filter(
      (c): c is CommandTreeItem => c !== null
    );
  }

  private buildCategoryIfNonEmpty(tasks: readonly CommandItem[], def: CategoryDef): CommandTreeItem | null {
    const matched = tasks.filter((t) => t.type === def.type);
    if (matched.length === 0) {
      return null;
    }
    return def.flat === true ? this.buildFlatCategory(def, matched) : this.buildCategoryWithFolders(def, matched);
  }

  private buildCategoryWithFolders(def: CategoryDef, tasks: CommandItem[]): CommandTreeItem {
    const children = buildNestedFolderItems({
      tasks,
      workspaceRoot: this.workspaceRoot,
      categoryId: def.label,
      sortTasks: (t) => this.sortTasks(t),
    });
    return createCategoryNode({
      label: `${def.label} (${tasks.length})`,
      children,
      type: def.type,
    });
  }

  private buildFlatCategory(def: CategoryDef, tasks: CommandItem[]): CommandTreeItem {
    const sorted = this.sortTasks(tasks);
    const children = createTaskNodes(sorted);
    return createCategoryNode({
      label: `${def.label} (${tasks.length})`,
      children,
      type: def.type,
    });
  }

  private getSortOrder(): SortOrder {
    return vscode.workspace.getConfiguration("commandtree").get<SortOrder>("sortOrder", "folder");
  }

  private sortTasks(tasks: CommandItem[]): CommandItem[] {
    const comparator = this.getComparator();
    return [...tasks].sort(comparator);
  }

  private comparePrivateTasks(a: CommandItem, b: CommandItem): number {
    return Number(isPrivateTask(a)) - Number(isPrivateTask(b));
  }

  private compareLabels(a: CommandItem, b: CommandItem): number {
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  }

  private getComparator(): (a: CommandItem, b: CommandItem) => number {
    const order = this.getSortOrder();
    if (order === "folder") {
      return (a, b) =>
        a.category.localeCompare(b.category, undefined, { sensitivity: "base" }) ||
        this.comparePrivateTasks(a, b) ||
        this.compareLabels(a, b);
    }
    if (order === "type") {
      return (a, b) =>
        a.type.localeCompare(b.type, undefined, { sensitivity: "base" }) ||
        this.comparePrivateTasks(a, b) ||
        this.compareLabels(a, b);
    }
    return (a, b) => this.comparePrivateTasks(a, b) || this.compareLabels(a, b);
  }

  private applyTagFilter(tasks: CommandItem[]): CommandItem[] {
    if (this.tagFilter === null || this.tagFilter === "") {
      return tasks;
    }
    const tag = this.tagFilter;
    return tasks.filter((t) => t.tags.includes(tag));
  }
}
