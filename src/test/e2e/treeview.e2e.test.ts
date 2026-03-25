/**
 * TREEVIEW E2E TESTS
 * TODO: No corresponding section in spec
 *
 * Tests tree view behavior by observing CommandTreeItem properties.
 * Verifies click behavior, item rendering, etc.
 */

import * as assert from "assert";
import { activateExtension, sleep, getCommandTreeProvider, getLabelString, collectLeafTasks } from "../helpers/helpers";
import { type CommandTreeItem, isCommandItem } from "../../models/TaskItem";

// TODO: No corresponding section in spec
suite("TreeView E2E Tests", () => {
  suiteSetup(async function () {
    this.timeout(30000);
    await activateExtension();
    await sleep(3000);
  });

  /**
   * Searches a node's children and grandchildren for the first command item.
   */
  async function findTaskInCategory(
    provider: ReturnType<typeof getCommandTreeProvider>,
    category: CommandTreeItem
  ): Promise<CommandTreeItem | undefined> {
    const children = await provider.getChildren(category);
    for (const child of children) {
      if (isCommandItem(child.data)) {
        return child;
      }
      const grandChildren = await provider.getChildren(child);
      const match = grandChildren.find((gc) => isCommandItem(gc.data));
      if (match !== undefined) {
        return match;
      }
    }
    return undefined;
  }

  /**
   * Finds the first task item (leaf node with a task) in the tree.
   */
  async function findFirstTaskItem(): Promise<CommandTreeItem | undefined> {
    const provider = getCommandTreeProvider();
    const categories = await provider.getChildren();

    for (const category of categories) {
      const found = await findTaskInCategory(provider, category);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }

  // TODO: No corresponding section in spec
  suite("Click Behavior", () => {
    test("clicking a task item opens the file in editor, NOT runs it", async function () {
      this.timeout(15000);

      const taskItem = await findFirstTaskItem();
      assert.ok(taskItem !== undefined, "Should find at least one task item in the tree");
      assert.ok(taskItem.command !== undefined, "Task item should have a click command");
      assert.strictEqual(
        taskItem.command.command,
        "vscode.open",
        "Clicking a task MUST open the file (vscode.open), NOT run it (commandtree.run)"
      );
      // Non-quick task must have 'task' contextValue so the EMPTY star icon shows
      assert.strictEqual(
        taskItem.contextValue,
        "task",
        "Non-quick task MUST have contextValue 'task' (empty star icon)"
      );
    });

    test("click command points to the task file path", async function () {
      this.timeout(15000);

      const taskItem = await findFirstTaskItem();
      assert.ok(taskItem !== undefined, "Should find a task item");
      assert.ok(taskItem.command !== undefined, "Should have click command");

      const args = taskItem.command.arguments;
      assert.ok(args !== undefined && args.length > 0, "Click command should have arguments (file URI)");

      const uri = args[0] as { fsPath?: string; scheme?: string };
      assert.ok(
        uri.fsPath !== undefined && uri.fsPath !== "",
        "Click command argument should be a file URI with fsPath"
      );
      assert.strictEqual(uri.scheme, "file", "URI scheme should be 'file'");
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
            `Category "${getLabelString(category.label)}" must NOT have a "Root" folder — root items should appear directly under the category`
          );
        }
      }
    });

    test("folders must come before files in tree — normal file/folder rules", async function () {
      this.timeout(15000);
      const provider = getCommandTreeProvider();
      const categories = await provider.getChildren();
      const shellCategory = categories.find((c) => getLabelString(c.label).includes("Shell Scripts"));
      assert.ok(shellCategory !== undefined, "Should find Shell Scripts category");

      const topChildren = await provider.getChildren(shellCategory);
      const mixedFolder = topChildren.find(
        (c) =>
          !isCommandItem(c.data) &&
          c.children.some((gc) => isCommandItem(gc.data)) &&
          c.children.some((gc) => !isCommandItem(gc.data))
      );
      assert.ok(mixedFolder !== undefined, "Should find a folder containing both files and subfolders");

      const kids = mixedFolder.children;
      let seenTask = false;
      for (const child of kids) {
        if (isCommandItem(child.data)) {
          seenTask = true;
        } else {
          assert.ok(!seenTask, "Folder node must not appear after a file node — folders come first");
        }
      }
    });
  });

  suite("AI Summaries", () => {
    test("@exclude-ci Copilot summarisation produces summaries for discovered tasks", async function () {
      this.timeout(15000);
      const provider = getCommandTreeProvider();
      // AI summaries: extension activation triggers summarisation via Copilot.
      // If Copilot auth fails (GitHubLoginFailed), tasks will have no summaries.
      // This MUST fail if the integration is broken.
      const allTasks = await collectLeafTasks(provider);
      const withSummary = allTasks.filter((t) => t.summary !== undefined && t.summary !== "");
      assert.ok(
        withSummary.length > 0,
        `Copilot summarisation must produce summaries — got 0 out of ${allTasks.length} tasks. ` +
          "Check for GitHubLoginFailed errors above."
      );
    });
  });
});
