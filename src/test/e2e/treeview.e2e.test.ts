/**
 * TREEVIEW E2E TESTS
 * TODO: No corresponding section in spec
 *
 * Tests tree view behavior by observing CommandTreeItem properties.
 * Verifies click behavior, item rendering, etc.
 */

import * as assert from "assert";
import {
  activateExtension,
  sleep,
  getCommandTreeProvider,
  getLabelString,
} from "../helpers/helpers";
import type { CommandTreeItem } from "../../models/TaskItem";

// TODO: No corresponding section in spec
suite("TreeView E2E Tests", () => {
  suiteSetup(async function () {
    this.timeout(30000);
    await activateExtension();
    await sleep(3000);
  });

  /**
   * Finds the first task item (leaf node with a task) in the tree.
   */
  async function findFirstTaskItem(): Promise<CommandTreeItem | undefined> {
    const provider = getCommandTreeProvider();
    const categories = await provider.getChildren();

    for (const category of categories) {
      const children = await provider.getChildren(category);
      for (const child of children) {
        if (child.task !== null) {
          return child;
        }
        // Check nested children (folder nodes)
        const grandChildren = await provider.getChildren(child);
        for (const gc of grandChildren) {
          if (gc.task !== null) {
            return gc;
          }
        }
      }
    }
    return undefined;
  }

  // TODO: No corresponding section in spec
  suite("Click Behavior", () => {
    test("clicking a task item opens the file in editor, NOT runs it", async function () {
      this.timeout(15000);

      const taskItem = await findFirstTaskItem();
      assert.ok(
        taskItem !== undefined,
        "Should find at least one task item in the tree",
      );
      assert.ok(
        taskItem.command !== undefined,
        "Task item should have a click command",
      );
      assert.strictEqual(
        taskItem.command.command,
        "vscode.open",
        "Clicking a task MUST open the file (vscode.open), NOT run it (commandtree.run)",
      );
      // Non-quick task must have 'task' contextValue so the EMPTY star icon shows
      assert.strictEqual(
        taskItem.contextValue,
        "task",
        "Non-quick task MUST have contextValue 'task' (empty star icon)",
      );
    });

    test("click command points to the task file path", async function () {
      this.timeout(15000);

      const taskItem = await findFirstTaskItem();
      assert.ok(taskItem !== undefined, "Should find a task item");
      assert.ok(taskItem.command !== undefined, "Should have click command");

      const args = taskItem.command.arguments;
      assert.ok(
        args !== undefined && args.length > 0,
        "Click command should have arguments (file URI)",
      );

      const uri = args[0] as { fsPath?: string; scheme?: string };
      assert.ok(
        uri.fsPath !== undefined && uri.fsPath !== "",
        "Click command argument should be a file URI with fsPath",
      );
      assert.strictEqual(
        uri.scheme,
        "file",
        "URI scheme should be 'file'",
      );
    });
  });

  suite("Folder Hierarchy", () => {
    test("root-level items appear directly under category — no Root folder node", async function () {
      this.timeout(15000);
      const provider = getCommandTreeProvider();
      const categories = await provider.getChildren();

      for (const category of categories) {
        const topChildren = await provider.getChildren(category);
        for (const child of topChildren) {
          const label = getLabelString(child.label);
          assert.notStrictEqual(
            label,
            "Root",
            `Category "${getLabelString(category.label)}" must NOT have a "Root" folder — root items should appear directly under the category`,
          );
        }
      }
    });

    test("folders must come before files in tree — normal file/folder rules", async function () {
      this.timeout(15000);
      const provider = getCommandTreeProvider();
      const categories = await provider.getChildren();
      const shellCategory = categories.find(
        (c) => getLabelString(c.label).includes("Shell Scripts"),
      );
      assert.ok(
        shellCategory !== undefined,
        "Should find Shell Scripts category",
      );

      const topChildren = await provider.getChildren(shellCategory);
      const mixedFolder = topChildren.find(
        (c) =>
          c.task === null &&
          c.children.some((gc) => gc.task !== null) &&
          c.children.some((gc) => gc.task === null),
      );
      assert.ok(
        mixedFolder !== undefined,
        "Should find a folder containing both files and subfolders",
      );

      const kids = mixedFolder.children;
      let seenTask = false;
      for (const child of kids) {
        if (child.task !== null) {
          seenTask = true;
        } else {
          assert.ok(
            !seenTask,
            "Folder node must not appear after a file node — folders come first",
          );
        }
      }
    });
  });
});
