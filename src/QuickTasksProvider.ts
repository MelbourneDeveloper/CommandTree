import * as vscode from 'vscode';
import type { TaskItem } from './models/TaskItem';
import { TaskTreeItem } from './models/TaskItem';
import { TagConfig } from './config/TagConfig';

/**
 * Provider for the Quick Tasks view - shows tasks tagged as "quick".
 */
export class QuickTasksProvider implements vscode.TreeDataProvider<TaskTreeItem> {
    private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<TaskTreeItem | undefined>();
    readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

    private readonly tagConfig: TagConfig;
    private allTasks: TaskItem[] = [];

    constructor(
        workspaceRoot: string
    ) {
        this.tagConfig = new TagConfig(workspaceRoot);
    }

    /**
     * Updates the list of all tasks and refreshes the view.
     */
    async updateTasks(tasks: TaskItem[]): Promise<void> {
        await this.tagConfig.load();
        this.allTasks = this.tagConfig.applyTags(tasks);
        this.onDidChangeTreeDataEmitter.fire(undefined);
    }

    /**
     * Adds a task to the quick list.
     */
    async addToQuick(task: TaskItem): Promise<void> {
        await this.tagConfig.addTaskToTag(task, 'quick');
        await this.tagConfig.load();
        this.allTasks = this.tagConfig.applyTags(this.allTasks);
        this.onDidChangeTreeDataEmitter.fire(undefined);
    }

    /**
     * Removes a task from the quick list.
     */
    async removeFromQuick(task: TaskItem): Promise<void> {
        await this.tagConfig.removeTaskFromTag(task, 'quick');
        await this.tagConfig.load();
        this.allTasks = this.tagConfig.applyTags(this.allTasks);
        this.onDidChangeTreeDataEmitter.fire(undefined);
    }

    /**
     * Refreshes the view.
     */
    refresh(): void {
        this.onDidChangeTreeDataEmitter.fire(undefined);
    }

    getTreeItem(element: TaskTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TaskTreeItem): TaskTreeItem[] {
        if (element !== undefined) {
            return element.children;
        }

        const quickTasks = this.allTasks.filter(task => task.tags.includes('quick'));

        if (quickTasks.length === 0) {
            return [new TaskTreeItem(null, 'No quick tasks - star tasks to add them here', [])];
        }

        return quickTasks.map(task => new TaskTreeItem(task, null, []));
    }
}
