import * as vscode from "vscode";
import { isPhonyTask, isPrivateTask } from "./models/TaskItem";
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

/**
 * Tree data provider for CommandTree view.
 */
export class CommandTreeProvider implements vscode.TreeDataProvider<CommandTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<CommandTreeItem | undefined>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private commands: CommandItem[] = [];
  private discoveryResult: DiscoveryResult | null = null;
  private tagFilter: string | null = null;
  private summaries: ReadonlyMap<string, CommandRow> = new Map();
  private readonly tagConfig: TagConfig;
  private readonly workspaceRoot: string;

  public constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.tagConfig = new TagConfig();
  }

  public async refresh(): Promise<void> {
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

  private compareHelpTasks(a: CommandItem, b: CommandItem): number {
    const isHelpA = a.type === "make" && a.label === "help";
    const isHelpB = b.type === "make" && b.label === "help";
    return Number(isHelpB) - Number(isHelpA);
  }

  private comparePhonyTasks(a: CommandItem, b: CommandItem): number {
    return Number(isPhonyTask(b)) - Number(isPhonyTask(a));
  }

  private compareMakeTaskPriority(a: CommandItem, b: CommandItem): number {
    if (a.type !== "make" || b.type !== "make") {
      return 0;
    }
    return this.compareHelpTasks(a, b) || this.comparePhonyTasks(a, b);
  }

  private getComparator(): (a: CommandItem, b: CommandItem) => number {
    const order = this.getSortOrder();
    if (order === "folder") {
      return (a, b) =>
        a.category.localeCompare(b.category) ||
        this.comparePrivateTasks(a, b) ||
        this.compareMakeTaskPriority(a, b) ||
        a.label.localeCompare(b.label);
    }
    if (order === "type") {
      return (a, b) =>
        a.type.localeCompare(b.type) ||
        this.comparePrivateTasks(a, b) ||
        this.compareMakeTaskPriority(a, b) ||
        a.label.localeCompare(b.label);
    }
    return (a, b) =>
      this.comparePrivateTasks(a, b) || this.compareMakeTaskPriority(a, b) || a.label.localeCompare(b.label);
  }

  private applyTagFilter(tasks: CommandItem[]): CommandItem[] {
    if (this.tagFilter === null || this.tagFilter === "") {
      return tasks;
    }
    const tag = this.tagFilter;
    return tasks.filter((t) => t.tags.includes(tag));
  }
}
