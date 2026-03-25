/**
 * SPEC: quick-launch, tagging
 * Provider for the Quick Launch view - shows commands tagged as "quick".
 * Uses junction table for ordering (display_order column).
 */

import * as vscode from "vscode";
import type { CommandItem, Result, CommandTreeItem } from "./models/TaskItem";
import { isCommandItem } from "./models/TaskItem";
import { TagConfig } from "./config/TagConfig";
import { getDb } from "./db/lifecycle";
import { getCommandIdsByTag } from "./db/db";
import { createCommandNode, createPlaceholderNode } from "./tree/nodeFactory";

const QUICK_TASK_MIME_TYPE = "application/vnd.commandtree.quicktask";
const QUICK_TAG = "quick";

/**
 * SPEC: quick-launch
 * Provider for the Quick Launch view - shows commands tagged as "quick".
 * Supports drag-and-drop reordering via display_order column.
 */
export class QuickTasksProvider
  implements
    vscode.TreeDataProvider<CommandTreeItem>,
    vscode.TreeDragAndDropController<CommandTreeItem>
{
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    CommandTreeItem | undefined
  >();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  readonly dropMimeTypes = [QUICK_TASK_MIME_TYPE];
  readonly dragMimeTypes = [QUICK_TASK_MIME_TYPE];

  private readonly tagConfig: TagConfig;
  private allTasks: CommandItem[] = [];

  constructor() {
    this.tagConfig = new TagConfig();
  }

  /**
   * SPEC: quick-launch
   * Updates the list of all tasks and refreshes the view.
   */
  updateTasks(tasks: CommandItem[]): void {
    this.tagConfig.load();
    this.allTasks = this.tagConfig.applyTags(tasks);
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  /**
   * SPEC: quick-launch
   * Adds a command to the quick list.
   */
  addToQuick(task: CommandItem): Result<void, string> {
    const result = this.tagConfig.addTaskToTag(task, QUICK_TAG);
    if (result.ok) {
      this.tagConfig.load();
      this.allTasks = this.tagConfig.applyTags(this.allTasks);
      this.onDidChangeTreeDataEmitter.fire(undefined);
    }
    return result;
  }

  /**
   * SPEC: quick-launch
   * Removes a command from the quick list.
   */
  removeFromQuick(task: CommandItem): Result<void, string> {
    const result = this.tagConfig.removeTaskFromTag(task, QUICK_TAG);
    if (result.ok) {
      this.tagConfig.load();
      this.allTasks = this.tagConfig.applyTags(this.allTasks);
      this.onDidChangeTreeDataEmitter.fire(undefined);
    }
    return result;
  }

  /**
   * Refreshes the view.
   */
  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  getTreeItem(element: CommandTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CommandTreeItem): CommandTreeItem[] {
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
    const quickTasks = this.allTasks.filter((task) =>
      task.tags.includes(QUICK_TAG),
    );
    if (quickTasks.length === 0) {
      return [
        createPlaceholderNode(
          "No quick commands - star commands to add them here",
        ),
      ];
    }
    const sorted = this.sortByDisplayOrder(quickTasks);
    return sorted.map((task) => createCommandNode(task));
  }

  /**
   * SPEC: quick-launch, tagging
   * Sorts tasks by display_order from junction table.
   */
  private sortByDisplayOrder(tasks: CommandItem[]): CommandItem[] {
    const dbResult = getDb();
    if (!dbResult.ok) {
      return tasks.sort((a, b) => a.label.localeCompare(b.label));
    }

    const orderedIdsResult = getCommandIdsByTag({
      handle: dbResult.value,
      tagName: QUICK_TAG,
    });
    if (!orderedIdsResult.ok) {
      return tasks.sort((a, b) => a.label.localeCompare(b.label));
    }

    const orderedIds = orderedIdsResult.value;
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
  handleDrag(
    source: readonly CommandTreeItem[],
    dataTransfer: vscode.DataTransfer,
  ): void {
    const taskItem = source[0];
    if (taskItem === undefined || !isCommandItem(taskItem.data)) {
      return;
    }
    dataTransfer.set(
      QUICK_TASK_MIME_TYPE,
      new vscode.DataTransferItem(taskItem.data.id),
    );
  }

  /**
   * SPEC: quick-launch
   * Called when dropping - reorders tasks in junction table.
   */
  handleDrop(
    target: CommandTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
  ): void {
    const draggedTask = this.extractDraggedTask(dataTransfer);
    if (draggedTask === undefined) {
      return;
    }

    const dbResult = getDb();
    if (!dbResult.ok) {
      return;
    }

    const orderedIdsResult = getCommandIdsByTag({
      handle: dbResult.value,
      tagName: QUICK_TAG,
    });
    if (!orderedIdsResult.ok) {
      return;
    }

    const orderedIds = orderedIdsResult.value;
    const currentIndex = orderedIds.indexOf(draggedTask.id);
    if (currentIndex === -1) {
      return;
    }

    const targetData =
      target !== undefined && isCommandItem(target.data)
        ? target.data
        : undefined;
    const targetIndex =
      targetData !== undefined
        ? orderedIds.indexOf(targetData.id)
        : orderedIds.length - 1;

    if (targetIndex === -1 || currentIndex === targetIndex) {
      return;
    }

    const reordered = [...orderedIds];
    reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, draggedTask.id);

    for (let i = 0; i < reordered.length; i++) {
      const commandId = reordered[i];
      if (commandId !== undefined) {
        dbResult.value.db.run(
          `UPDATE command_tags
                     SET display_order = ?
                     WHERE command_id = ?
                     AND tag_id = (SELECT tag_id FROM tags WHERE tag_name = ?)`,
          [i, commandId, QUICK_TAG],
        );
      }
    }

    this.tagConfig.load();
    this.allTasks = this.tagConfig.applyTags(this.allTasks);
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  /**
   * Extracts the dragged task from a data transfer.
   */
  private extractDraggedTask(
    dataTransfer: vscode.DataTransfer,
  ): CommandItem | undefined {
    const transferItem = dataTransfer.get(QUICK_TASK_MIME_TYPE);
    if (transferItem === undefined) {
      return undefined;
    }
    const draggedId = transferItem.value as string;
    if (draggedId === "") {
      return undefined;
    }
    return this.allTasks.find(
      (t) => t.id === draggedId && t.tags.includes(QUICK_TAG),
    );
  }
}
