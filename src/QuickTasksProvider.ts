/**
 * SPEC: quick-launch, tagging
 * Provider for the Quick Launch view - shows commands tagged as "quick".
 * Uses junction table for ordering (display_order column).
 */

import * as vscode from "vscode";
import type { CommandItem, CommandTreeItem } from "./models/TaskItem";
import { isCommandItem } from "./models/TaskItem";
import { TagConfig } from "./config/TagConfig";
import { getDbOrThrow } from "./db/lifecycle";
import { getCommandIdsByTag, reorderTagCommands } from "./db/db";
import { createCommandNode, createPlaceholderNode } from "./tree/nodeFactory";

const QUICK_TASK_MIME_TYPE = "application/vnd.commandtree.quicktask";
const QUICK_TAG = "quick";

/**
 * SPEC: quick-launch
 * Provider for the Quick Launch view - shows commands tagged as "quick".
 * Supports drag-and-drop reordering via display_order column.
 */
export class QuickTasksProvider
  implements vscode.TreeDataProvider<CommandTreeItem>, vscode.TreeDragAndDropController<CommandTreeItem>
{
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<CommandTreeItem | undefined>();
  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  public readonly dropMimeTypes = [QUICK_TASK_MIME_TYPE];
  public readonly dragMimeTypes = [QUICK_TASK_MIME_TYPE];

  private readonly tagConfig: TagConfig;
  private allTasks: CommandItem[] = [];

  public constructor() {
    this.tagConfig = new TagConfig();
  }

  /**
   * SPEC: quick-launch
   * Updates the list of all tasks and refreshes the view.
   */
  public updateTasks(tasks: CommandItem[]): void {
    this.tagConfig.load();
    this.allTasks = this.tagConfig.applyTags(tasks);
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  /**
   * SPEC: quick-launch
   * Adds a command to the quick list.
   */
  public addToQuick(task: CommandItem): void {
    this.tagConfig.addTaskToTag(task, QUICK_TAG);
    this.tagConfig.load();
    this.allTasks = this.tagConfig.applyTags(this.allTasks);
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  /**
   * SPEC: quick-launch
   * Removes a command from the quick list.
   */
  public removeFromQuick(task: CommandItem): void {
    this.tagConfig.removeTaskFromTag(task, QUICK_TAG);
    this.tagConfig.load();
    this.allTasks = this.tagConfig.applyTags(this.allTasks);
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  /**
   * Refreshes the view.
   */
  public refresh(): void {
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  public getTreeItem(element: CommandTreeItem): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: CommandTreeItem): CommandTreeItem[] {
    if (element !== undefined) {
      return element.children;
    }
    return this.buildQuickItems();
  }

  /**
   * SPEC: quick-launch
   * Builds quick task tree items ordered by display_order from junction table.
   */
  private buildQuickItems(): CommandTreeItem[] {
    const quickTasks = this.allTasks.filter((task) => task.tags.includes(QUICK_TAG));
    if (quickTasks.length === 0) {
      return [createPlaceholderNode("No quick commands - star commands to add them here")];
    }
    const sorted = this.sortByDisplayOrder(quickTasks);
    return sorted.map((task) => createCommandNode(task));
  }

  /**
   * SPEC: quick-launch, tagging
   * Sorts tasks by display_order from junction table.
   */
  private sortByDisplayOrder(tasks: CommandItem[]): CommandItem[] {
    const handle = getDbOrThrow();
    const orderedIds = getCommandIdsByTag({ handle, tagName: QUICK_TAG });
    return [...tasks].sort((a, b) => {
      const indexA = orderedIds.indexOf(a.id);
      const indexB = orderedIds.indexOf(b.id);
      if (indexA === -1 && indexB === -1) {
        return a.label.localeCompare(b.label);
      }
      if (indexA === -1) {
        return 1;
      }
      if (indexB === -1) {
        return -1;
      }
      return indexA - indexB;
    });
  }

  /**
   * Called when dragging starts.
   */
  public handleDrag(source: readonly CommandTreeItem[], dataTransfer: vscode.DataTransfer): void {
    const taskItem = source[0];
    if (taskItem === undefined || !isCommandItem(taskItem.data)) {
      return;
    }
    dataTransfer.set(QUICK_TASK_MIME_TYPE, new vscode.DataTransferItem(taskItem.data.id));
  }

  /**
   * SPEC: quick-launch
   * Called when dropping - reorders tasks in junction table.
   */
  public handleDrop(target: CommandTreeItem | undefined, dataTransfer: vscode.DataTransfer): void {
    const draggedTask = this.extractDraggedTask(dataTransfer);
    if (draggedTask === undefined) {
      return;
    }

    const orderedIds = this.fetchOrderedQuickIds();
    const reordered = this.computeReorder({ orderedIds, draggedTask, target });
    if (reordered === undefined) {
      return;
    }

    this.persistDisplayOrder(reordered);
    this.reloadAndRefresh();
  }

  /**
   * Fetches ordered command IDs for the quick tag from the DB.
   */
  private fetchOrderedQuickIds(): string[] {
    const handle = getDbOrThrow();
    return getCommandIdsByTag({ handle, tagName: QUICK_TAG });
  }

  /**
   * Computes the reordered ID list after a drag-and-drop, or undefined if no change needed.
   */
  private computeReorder({
    orderedIds,
    draggedTask,
    target,
  }: {
    orderedIds: string[];
    draggedTask: CommandItem;
    target: CommandTreeItem | undefined;
  }): string[] | undefined {
    const currentIndex = orderedIds.indexOf(draggedTask.id);
    if (currentIndex === -1) {
      return undefined;
    }

    const targetData = target !== undefined && isCommandItem(target.data) ? target.data : undefined;
    const targetIndex = targetData !== undefined ? orderedIds.indexOf(targetData.id) : orderedIds.length - 1;

    if (targetIndex === -1 || currentIndex === targetIndex) {
      return undefined;
    }

    const reordered = [...orderedIds];
    reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, draggedTask.id);
    return reordered;
  }

  /**
   * Persists display_order for each command in the reordered list.
   */
  private persistDisplayOrder(reordered: string[]): void {
    const handle = getDbOrThrow();
    reorderTagCommands({ handle, tagName: QUICK_TAG, orderedCommandIds: reordered });
  }

  /**
   * Reloads tag config and refreshes the tree view.
   */
  private reloadAndRefresh(): void {
    this.tagConfig.load();
    this.allTasks = this.tagConfig.applyTags(this.allTasks);
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  /**
   * Extracts the dragged task from a data transfer.
   */
  private extractDraggedTask(dataTransfer: vscode.DataTransfer): CommandItem | undefined {
    const transferItem = dataTransfer.get(QUICK_TASK_MIME_TYPE);
    if (transferItem === undefined) {
      return undefined;
    }
    const draggedId = transferItem.value as string;
    if (draggedId === "") {
      return undefined;
    }
    return this.allTasks.find((t) => t.id === draggedId && t.tags.includes(QUICK_TAG));
  }
}
