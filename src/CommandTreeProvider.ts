import * as vscode from 'vscode';
import type { TaskItem, Result } from './models/TaskItem';
import { CommandTreeItem } from './models/TaskItem';
import type { DiscoveryResult } from './discovery';
import { discoverAllTasks, flattenTasks, getExcludePatterns } from './discovery';
import { TagConfig } from './config/TagConfig';
import { logger } from './utils/logger';
import { buildNestedFolderItems } from './tree/folderTree';

type SortOrder = 'folder' | 'name' | 'type';

interface CategoryDef {
    readonly type: string;
    readonly label: string;
    readonly flat?: boolean;
}

const CATEGORY_DEFS: readonly CategoryDef[] = [
    { type: 'shell', label: 'Shell Scripts' },
    { type: 'npm', label: 'NPM Scripts' },
    { type: 'make', label: 'Make Targets' },
    { type: 'launch', label: 'VS Code Launch', flat: true },
    { type: 'vscode', label: 'VS Code Tasks', flat: true },
    { type: 'python', label: 'Python Scripts' },
    { type: 'powershell', label: 'PowerShell/Batch' },
    { type: 'gradle', label: 'Gradle Tasks' },
    { type: 'cargo', label: 'Cargo (Rust)' },
    { type: 'maven', label: 'Maven Goals' },
    { type: 'ant', label: 'Ant Targets' },
    { type: 'just', label: 'Just Recipes' },
    { type: 'taskfile', label: 'Taskfile' },
    { type: 'deno', label: 'Deno Tasks' },
    { type: 'rake', label: 'Rake Tasks' },
    { type: 'composer', label: 'Composer Scripts' },
    { type: 'docker', label: 'Docker Compose' },
    { type: 'dotnet', label: '.NET Projects' },
    { type: 'markdown', label: 'Markdown Files' },
];

/**
 * Tree data provider for CommandTree view.
 */
export class CommandTreeProvider implements vscode.TreeDataProvider<CommandTreeItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<CommandTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private tasks: TaskItem[] = [];
    private discoveryResult: DiscoveryResult | null = null;
    private tagFilter: string | null = null;
    private readonly tagConfig: TagConfig;
    private readonly workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.tagConfig = new TagConfig();
    }

    async refresh(): Promise<void> {
        this.tagConfig.load();
        const excludePatterns = getExcludePatterns();
        this.discoveryResult = await discoverAllTasks(this.workspaceRoot, excludePatterns);
        this.tasks = this.tagConfig.applyTags(flattenTasks(this.discoveryResult));
        this._onDidChangeTreeData.fire(undefined);
    }

    setTagFilter(tag: string | null): void {
        logger.filter('setTagFilter', { tagFilter: tag });
        this.tagFilter = tag;
        this._onDidChangeTreeData.fire(undefined);
    }

    clearFilters(): void {
        this.tagFilter = null;
        this._onDidChangeTreeData.fire(undefined);
    }

    hasFilter(): boolean {
        return this.tagFilter !== null;
    }

    getAllTags(): string[] {
        const tags = new Set<string>();
        for (const task of this.tasks) {
            for (const tag of task.tags) {
                tags.add(tag);
            }
        }
        for (const tag of this.tagConfig.getTagNames()) {
            tags.add(tag);
        }
        return Array.from(tags).sort();
    }

    async addTaskToTag(task: TaskItem, tagName: string): Promise<Result<void, string>> {
        const result = this.tagConfig.addTaskToTag(task, tagName);
        if (result.ok) {
            await this.refresh();
        }
        return result;
    }

    async removeTaskFromTag(task: TaskItem, tagName: string): Promise<Result<void, string>> {
        const result = this.tagConfig.removeTaskFromTag(task, tagName);
        if (result.ok) {
            await this.refresh();
        }
        return result;
    }

    getAllTasks(): TaskItem[] {
        return this.tasks;
    }

    getTreeItem(element: CommandTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: CommandTreeItem): Promise<CommandTreeItem[]> {
        if (!this.discoveryResult) {
            await this.refresh();
        }
        if (!element) {
            return this.buildRootCategories();
        }
        return element.children;
    }

    private buildRootCategories(): CommandTreeItem[] {
        const filtered = this.applyTagFilter(this.tasks);
        return CATEGORY_DEFS
            .map(def => this.buildCategoryIfNonEmpty(filtered, def))
            .filter((c): c is CommandTreeItem => c !== null);
    }

    private buildCategoryIfNonEmpty(
        tasks: readonly TaskItem[],
        def: CategoryDef
    ): CommandTreeItem | null {
        const matched = tasks.filter(t => t.type === def.type);
        if (matched.length === 0) { return null; }
        return def.flat === true
            ? this.buildFlatCategory(def.label, matched)
            : this.buildCategoryWithFolders(def.label, matched);
    }

    private buildCategoryWithFolders(name: string, tasks: TaskItem[]): CommandTreeItem {
        const children = buildNestedFolderItems({
            tasks,
            workspaceRoot: this.workspaceRoot,
            categoryId: name,
            sortTasks: (t) => this.sortTasks(t)
        });
        return new CommandTreeItem(null, `${name} (${tasks.length})`, children);
    }

    private buildFlatCategory(name: string, tasks: TaskItem[]): CommandTreeItem {
        const sorted = this.sortTasks(tasks);
        const categoryId = name;
        const children = sorted.map(t => new CommandTreeItem(t, null, [], categoryId));
        return new CommandTreeItem(null, `${name} (${tasks.length})`, children);
    }

    private getSortOrder(): SortOrder {
        return vscode.workspace
            .getConfiguration('commandtree')
            .get<SortOrder>('sortOrder', 'folder');
    }

    private sortTasks(tasks: TaskItem[]): TaskItem[] {
        const comparator = this.getComparator();
        return [...tasks].sort(comparator);
    }

    private getComparator(): (a: TaskItem, b: TaskItem) => number {
        const order = this.getSortOrder();
        if (order === 'folder') {
            return (a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label);
        }
        if (order === 'type') {
            return (a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label);
        }
        return (a, b) => a.label.localeCompare(b.label);
    }

    private applyTagFilter(tasks: TaskItem[]): TaskItem[] {
        if (this.tagFilter === null || this.tagFilter === '') { return tasks; }
        const tag = this.tagFilter;
        return tasks.filter(t => t.tags.includes(tag));
    }
}
