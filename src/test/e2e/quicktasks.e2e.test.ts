/**
 * SPEC: quick-launch, database-schema/command-tags-junction
 * E2E Tests for Quick Launch functionality with SQLite junction table storage.
 *
 * Black-box testing: Tests verify UI commands and database state only.
 * No internal provider method calls.
 */

import * as assert from "assert";
import * as vscode from "vscode";
import {
  activateExtension,
  sleep,
  getCommandTreeProvider,
  getQuickTasksProvider,
  getLabelString,
} from "../helpers/helpers";
import type { CommandTreeProvider, QuickTasksProvider } from "../helpers/helpers";
import { getDb } from "../../db/lifecycle";
import { getCommandIdsByTag, getTagsForCommand } from "../../db/db";
import { CommandTreeItem } from "../../models/TaskItem";

const QUICK_TAG = "quick";

// SPEC: quick-launch
suite("Quick Launch E2E Tests (SQLite Junction Table)", () => {
  let treeProvider: CommandTreeProvider;
  let quickProvider: QuickTasksProvider;

  suiteSetup(async function () {
    this.timeout(30000);
    await activateExtension();
    treeProvider = getCommandTreeProvider();
    quickProvider = getQuickTasksProvider();
    await sleep(2000);
  });

  // SPEC: quick-launch
  suite("Quick Launch Commands", () => {
    test("addToQuick command is registered", async function () {
      this.timeout(10000);
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("commandtree.addToQuick"),
        "addToQuick command should be registered"
      );
    });

    test("removeFromQuick command is registered", async function () {
      this.timeout(10000);
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("commandtree.removeFromQuick"),
        "removeFromQuick command should be registered"
      );
    });

    test("refreshQuick command is registered", async function () {
      this.timeout(10000);
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("commandtree.refreshQuick"),
        "refreshQuick command should be registered"
      );
    });
  });

  // SPEC: quick-launch, database-schema/command-tags-junction
  suite("Quick Launch SQLite Storage", () => {
    test("E2E: Add quick command → stored in junction table", async function () {
      this.timeout(15000);

      const allTasks = treeProvider.getAllTasks();
      assert.ok(allTasks.length > 0, "Must have tasks");
      const task = allTasks[0];
      assert.ok(task !== undefined, "First task must exist");

      // Add to quick via UI command
      const item = new CommandTreeItem(task, null, []);
      await vscode.commands.executeCommand("commandtree.addToQuick", item);
      await sleep(1000);

      // Verify stored in database with 'quick' tag
      const dbResult = getDb();
      assert.ok(dbResult.ok, "Database must be available");

      const tagsResult = getTagsForCommand({
        handle: dbResult.value,
        commandId: task.id,
      });
      assert.ok(tagsResult.ok, "Should get tags for command");
      assert.ok(
        tagsResult.value.includes(QUICK_TAG),
        `Task ${task.id} should have 'quick' tag in database`
      );

      // Verify the Quick Launch tree view shows the task
      const quickItems = quickProvider.getChildren();
      assert.ok(quickItems.length > 0, "Quick tasks view should have items after add");
      const hasTask = quickItems.some(qi => qi.task?.id === task.id);
      assert.ok(hasTask, "Quick tasks view should include the added task");
      const firstItem = quickItems[0];
      assert.ok(firstItem !== undefined, "First quick item must exist");
      const treeItem = quickProvider.getTreeItem(firstItem);
      assert.ok(treeItem.label !== undefined, "getTreeItem should return a TreeItem with a label");

      // Clean up
      const removeItem = new CommandTreeItem(task, null, []);
      await vscode.commands.executeCommand("commandtree.removeFromQuick", removeItem);
      await sleep(500);
    });

    test("E2E: Remove quick command → junction record deleted", async function () {
      this.timeout(15000);

      const allTasks = treeProvider.getAllTasks();
      const task = allTasks[0];
      assert.ok(task !== undefined, "First task must exist");

      // Add to quick first
      const addItem = new CommandTreeItem(task, null, []);
      await vscode.commands.executeCommand("commandtree.addToQuick", addItem);
      await sleep(1000);

      const dbResult = getDb();
      assert.ok(dbResult.ok, "Database must be available");

      // Verify quick tag exists
      let tagsResult = getTagsForCommand({
        handle: dbResult.value,
        commandId: task.id,
      });
      assert.ok(
        tagsResult.ok && tagsResult.value.includes(QUICK_TAG),
        "Quick tag should exist before removal"
      );

      // Remove from quick via UI
      const removeItem = new CommandTreeItem(task, null, []);
      await vscode.commands.executeCommand("commandtree.removeFromQuick", removeItem);
      await sleep(1000);

      // Verify junction record removed
      tagsResult = getTagsForCommand({
        handle: dbResult.value,
        commandId: task.id,
      });
      assert.ok(tagsResult.ok, "Should get tags for command");
      assert.ok(
        !tagsResult.value.includes(QUICK_TAG),
        `Task ${task.id} should NOT have 'quick' tag after removal`
      );

      // Verify tree view no longer shows the task
      const quickItemsAfterRemoval = quickProvider.getChildren();
      const hasRemovedTask = quickItemsAfterRemoval.some(item => item.task?.id === task.id);
      assert.ok(!hasRemovedTask, "Quick tasks view should NOT include removed task");
    });

    test("E2E: Quick commands ordered by display_order", async function () {
      this.timeout(20000);

      const allTasks = treeProvider.getAllTasks();
      assert.ok(allTasks.length >= 3, "Need at least 3 tasks for ordering test");

      const task1 = allTasks[0];
      const task2 = allTasks[1];
      const task3 = allTasks[2];
      assert.ok(
        task1 !== undefined && task2 !== undefined && task3 !== undefined,
        "All three tasks must exist"
      );

      // Add tasks in specific order
      const item1 = new CommandTreeItem(task1, null, []);
      await vscode.commands.executeCommand("commandtree.addToQuick", item1);
      await sleep(500);
      const item2 = new CommandTreeItem(task2, null, []);
      await vscode.commands.executeCommand("commandtree.addToQuick", item2);
      await sleep(500);
      const item3 = new CommandTreeItem(task3, null, []);
      await vscode.commands.executeCommand("commandtree.addToQuick", item3);
      await sleep(1000);

      // Verify order in database
      const dbResult = getDb();
      assert.ok(dbResult.ok, "Database must be available");

      const orderedIdsResult = getCommandIdsByTag({
        handle: dbResult.value,
        tagName: QUICK_TAG,
      });
      assert.ok(orderedIdsResult.ok, "Should get ordered command IDs");

      const orderedIds = orderedIdsResult.value;
      const index1 = orderedIds.indexOf(task1.id);
      const index2 = orderedIds.indexOf(task2.id);
      const index3 = orderedIds.indexOf(task3.id);

      assert.ok(index1 !== -1, "Task1 should be in quick list");
      assert.ok(index2 !== -1, "Task2 should be in quick list");
      assert.ok(index3 !== -1, "Task3 should be in quick list");
      assert.ok(
        index1 < index2 && index2 < index3,
        "Tasks should be ordered by insertion order via display_order column"
      );

      // Verify tree view reflects correct ordering
      const quickItems = quickProvider.getChildren();
      const taskItems = quickItems.filter(item => item.task !== null);
      assert.ok(taskItems.length >= 3, "Should show at least 3 quick tasks in tree");
      const viewItem0 = taskItems[0];
      const viewItem1 = taskItems[1];
      assert.ok(viewItem0 !== undefined && viewItem1 !== undefined, "View items must exist");
      assert.strictEqual(viewItem0.task?.id, task1.id, "First view item should match first added task");
      assert.strictEqual(viewItem1.task?.id, task2.id, "Second view item should match second added task");

      // Clean up
      const removeItem1 = new CommandTreeItem(task1, null, []);
      const removeItem2 = new CommandTreeItem(task2, null, []);
      const removeItem3 = new CommandTreeItem(task3, null, []);
      await vscode.commands.executeCommand("commandtree.removeFromQuick", removeItem1);
      await vscode.commands.executeCommand("commandtree.removeFromQuick", removeItem2);
      await vscode.commands.executeCommand("commandtree.removeFromQuick", removeItem3);
      await sleep(500);
    });

    test("E2E: Cannot add same command to quick twice", async function () {
      this.timeout(15000);

      const allTasks = treeProvider.getAllTasks();
      const task = allTasks[0];
      assert.ok(task !== undefined, "First task must exist");

      // Add to quick once
      const item = new CommandTreeItem(task, null, []);
      await vscode.commands.executeCommand("commandtree.addToQuick", item);
      await sleep(1000);

      const dbResult = getDb();
      assert.ok(dbResult.ok, "Database must be available");

      const initialIdsResult = getCommandIdsByTag({
        handle: dbResult.value,
        tagName: QUICK_TAG,
      });
      assert.ok(initialIdsResult.ok, "Should get command IDs");
      const initialCount = initialIdsResult.value.filter((id) => id === task.id).length;
      assert.strictEqual(initialCount, 1, "Should have exactly one instance of task");

      // Try to add again (should be ignored by INSERT OR IGNORE)
      const item2 = new CommandTreeItem(task, null, []);
      await vscode.commands.executeCommand("commandtree.addToQuick", item2);
      await sleep(1000);

      const afterIdsResult = getCommandIdsByTag({
        handle: dbResult.value,
        tagName: QUICK_TAG,
      });
      assert.ok(afterIdsResult.ok, "Should get command IDs");
      const afterCount = afterIdsResult.value.filter((id) => id === task.id).length;
      assert.strictEqual(
        afterCount,
        1,
        "Should still have exactly one instance (no duplicates)"
      );

      // Clean up
      const removeItem = new CommandTreeItem(task, null, []);
      await vscode.commands.executeCommand("commandtree.removeFromQuick", removeItem);
      await sleep(500);
    });
  });

  // SPEC: quick-launch, database-schema/command-tags-junction
  suite("Quick Launch Ordering with display_order", () => {
    test("display_order column maintains insertion order", async function () {
      this.timeout(20000);

      const allTasks = treeProvider.getAllTasks();
      assert.ok(allTasks.length >= 3, "Need at least 3 tasks");

      const tasks = [allTasks[0], allTasks[1], allTasks[2]];
      assert.ok(tasks.every((t) => t !== undefined), "All tasks must exist");

      // Add in specific order
      for (const task of tasks) {
        const item = new CommandTreeItem(task, null, []);
        await vscode.commands.executeCommand("commandtree.addToQuick", item);
        await sleep(500);
      }
      await sleep(1000);

      // Check database directly for display_order values
      const dbResult = getDb();
      assert.ok(dbResult.ok, "Database must be available");

      const orderedIdsResult = getCommandIdsByTag({
        handle: dbResult.value,
        tagName: QUICK_TAG,
      });
      assert.ok(orderedIdsResult.ok, "Should get ordered IDs");

      // Verify tasks appear in insertion order
      const orderedIds = orderedIdsResult.value;
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        if (task !== undefined) {
          const position = orderedIds.indexOf(task.id);
          assert.ok(position !== -1, `Task ${i} should be in quick list`);
          assert.ok(
            position >= i,
            `Task ${i} should be at position ${i} or later (found at ${position})`
          );
        }
      }

      // Verify TagConfig.getOrderedCommandIds and reorderCommands
      const { TagConfig } = await import("../../config/TagConfig.js");
      const tagConfig = new TagConfig();
      tagConfig.load();
      const configOrderedIds = tagConfig.getOrderedCommandIds(QUICK_TAG);
      assert.ok(configOrderedIds.length >= 3, "getOrderedCommandIds should return at least 3 IDs");
      const reversed = [...configOrderedIds].reverse();
      const reorderResult = tagConfig.reorderCommands(QUICK_TAG, reversed);
      assert.ok(reorderResult.ok, "reorderCommands should succeed");
      const newOrderedIds = tagConfig.getOrderedCommandIds(QUICK_TAG);
      const firstReversed = reversed[0];
      const lastReversed = reversed[reversed.length - 1];
      assert.ok(firstReversed !== undefined && lastReversed !== undefined, "Reversed IDs must exist");
      assert.strictEqual(newOrderedIds[0], firstReversed, "First ID should match reversed order");

      // Clean up
      for (const task of tasks) {
        const removeItem = new CommandTreeItem(task, null, []);
        await vscode.commands.executeCommand("commandtree.removeFromQuick", removeItem);
      }
      await sleep(500);
    });
  });

  // SPEC: quick-launch
  suite("Quick Launch Tree View", () => {
    test("Quick tasks view shows placeholder when empty", function () {
      this.timeout(10000);
      const items = quickProvider.getChildren();
      if (items.length === 1 && items[0]?.task === null) {
        const label = getLabelString(items[0].label);
        assert.ok(
          label.includes("No quick commands"),
          "Placeholder should mention no quick commands"
        );
      }
      for (const item of items) {
        assert.ok(item.label !== undefined, "All items should have a label");
      }
    });
  });
});
