/**
 * TREEVIEW E2E TESTS
 * TODO: No corresponding section in spec
 *
 * Tests tree view behavior by observing CommandTreeItem properties.
 * Verifies click behavior, item rendering, etc.
 */

import * as assert from "assert";
import * as vscode from "vscode";
import {
  activateExtension,
  sleep,
  getCommandTreeProvider,
  getLabelString,
  collectLeafItems,
  collectLeafTasks,
  refreshTasks,
  writeFile,
  deleteFile,
} from "../helpers/helpers";
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

  /**
   * Executes a tree item's click command (simulates what VS Code does on click).
   */
  async function executeItemClick(item: CommandTreeItem): Promise<void> {
    assert.ok(item.command !== undefined, "Item must have a click command");
    const args = (item.command.arguments ?? []) as [vscode.Uri, ...unknown[]];
    await vscode.commands.executeCommand(item.command.command, ...args);
  }

  suite("Make Target Line Navigation", () => {
    test("clicking 'build' make target opens Makefile at the build target line, not the top", async function () {
      this.timeout(20000);
      const provider = getCommandTreeProvider();
      const allItems = await collectLeafItems(provider);
      const buildItem = allItems.find(
        (i) => isCommandItem(i.data) && i.data.type === "make" && i.data.label === "build"
      );
      assert.ok(buildItem !== undefined, "Should find 'build' make target in tree");
      // Execute the click command — this is what happens when the user taps the item
      await executeItemClick(buildItem);
      await sleep(1000);

      // The editor must now be open on the Makefile
      const editor = vscode.window.activeTextEditor;
      assert.ok(editor !== undefined, "An editor must be open after clicking the make target");
      assert.ok(editor.document.uri.fsPath.endsWith("Makefile"), "The open file must be the Makefile");

      // The cursor must be on the build target line (line 5 in fixture, 0-indexed = 4)
      const cursorLine = editor.selection.active.line;
      assert.strictEqual(cursorLine, 4, "Cursor must be on line 4 (0-indexed) where 'build:' is defined — not line 0");
    });

    test("clicking 'clean' make target navigates to a different line than 'build'", async function () {
      this.timeout(20000);
      const provider = getCommandTreeProvider();
      const allItems = await collectLeafItems(provider);
      const cleanItem = allItems.find(
        (i) => isCommandItem(i.data) && i.data.type === "make" && i.data.label === "clean"
      );
      assert.ok(cleanItem !== undefined, "Should find 'clean' make target in tree");
      await executeItemClick(cleanItem);
      await sleep(1000);

      const editor = vscode.window.activeTextEditor;
      assert.ok(editor !== undefined, "An editor must be open after clicking the make target");
      assert.ok(editor.document.uri.fsPath.endsWith("Makefile"), "The open file must be the Makefile");

      // clean: is on line 11 in the fixture (0-indexed = 10)
      const cursorLine = editor.selection.active.line;
      assert.strictEqual(cursorLine, 10, "Cursor must be on line 10 (0-indexed) where 'clean:' is defined");
    });

    test("each make target click navigates to its own line — not all the same line", async function () {
      this.timeout(30000);
      const provider = getCommandTreeProvider();
      const allItems = await collectLeafItems(provider);
      const makeItems = allItems.filter((i) => isCommandItem(i.data) && i.data.type === "make");
      assert.ok(makeItems.length >= 3, "Should have at least 3 make targets to compare");

      const lines: number[] = [];
      for (const item of makeItems) {
        await executeItemClick(item);
        await sleep(500);

        const editor = vscode.window.activeTextEditor;
        assert.ok(editor !== undefined, "Editor must be open");
        lines.push(editor.selection.active.line);
      }

      // If all targets opened at the top of the file, all lines would be 0
      const uniqueLines = new Set(lines);
      assert.ok(
        uniqueLines.size > 1,
        `Each make target must navigate to its own line — got ${JSON.stringify(lines)} (all same = broken)`
      );
      assert.ok(!lines.every((l) => l === 0), "Make targets must NOT all open at line 0 — line navigation is broken");
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

  suite("Private Make And Mise Tasks", () => {
    const makeRelativePath = "private-targets/Makefile";
    const miseRelativePath = "private-targets/mise.toml";
    const publicLabels = ["alpha_public", "zeta_public"];
    const privateLabels = ["_beta_private", "_omega_private"];

    function getThemeColorId(item: CommandTreeItem): string | undefined {
      const { iconPath } = item;
      return iconPath instanceof vscode.ThemeIcon ? iconPath.color?.id : undefined;
    }

    async function getItemsForFile(type: "make" | "mise", relativePath: string): Promise<CommandTreeItem[]> {
      const provider = getCommandTreeProvider();
      const items = await collectLeafItems(provider);
      return items.filter(
        (item) => isCommandItem(item.data) && item.data.type === type && item.data.filePath.endsWith(relativePath)
      );
    }

    async function getFolderChildrenForCategory(
      categoryLabel: string,
      folderLabel: string
    ): Promise<CommandTreeItem[]> {
      const provider = getCommandTreeProvider();
      const categories = await provider.getChildren();
      const category = categories.find((item) => getLabelString(item.label).includes(categoryLabel));
      assert.ok(category !== undefined, `Should find category ${categoryLabel}`);

      const children = await provider.getChildren(category);
      const folder = children.find((item) => getLabelString(item.label) === folderLabel);
      assert.ok(folder !== undefined, `Should find folder ${folderLabel}`);

      return await provider.getChildren(folder);
    }

    setup(async function () {
      this.timeout(15000);

      writeFile(
        makeRelativePath,
        [
          "alpha_public:",
          "\t@echo alpha",
          "",
          "zeta_public:",
          "\t@echo zeta",
          "",
          "_beta_private:",
          "\t@echo beta",
          "",
          "_omega_private:",
          "\t@echo omega",
        ].join("\n")
      );

      writeFile(
        miseRelativePath,
        [
          "[tasks.alpha_public]",
          'description = "Public alpha task"',
          'run = "echo alpha"',
          "",
          "[tasks.zeta_public]",
          'run = "echo zeta"',
          "",
          "[tasks._beta_private]",
          'run = "echo beta"',
          "",
          "[tasks._omega_private]",
          'run = "echo omega"',
        ].join("\n")
      );

      await refreshTasks();
    });

    teardown(async function () {
      this.timeout(15000);
      deleteFile(makeRelativePath);
      deleteFile(miseRelativePath);
      await refreshTasks();
    });

    test("make private targets sort after public ones and render muted", async function () {
      this.timeout(15000);

      const items = await getItemsForFile("make", makeRelativePath);
      const labels = items.map((item) => getLabelString(item.label));
      const folderChildren = await getFolderChildrenForCategory("Make Targets", "private-targets");
      const folderLabels = folderChildren.map((item) => getLabelString(item.label));

      assert.deepStrictEqual(
        folderLabels,
        [...publicLabels, ...privateLabels],
        "Make targets should keep public targets first without rendering a divider row"
      );

      assert.deepStrictEqual(
        labels,
        [...publicLabels, ...privateLabels],
        "Make targets should keep public targets first and move _-prefixed private targets below them"
      );

      const privateItems = items.filter((item) => privateLabels.includes(getLabelString(item.label)));
      assert.strictEqual(privateItems.length, privateLabels.length, "Should find all private make targets");

      for (const item of privateItems) {
        const description = typeof item.description === "string" ? item.description : "";
        assert.ok(
          description.includes("private"),
          `Private make target ${getLabelString(item.label)} should be visibly marked as private`
        );
        assert.strictEqual(
          getThemeColorId(item),
          "descriptionForeground",
          `Private make target ${getLabelString(item.label)} should use a muted icon color`
        );
        assert.strictEqual(
          item.resourceUri?.scheme,
          "commandtree-private",
          `Private make target ${getLabelString(item.label)} must carry a private resourceUri so the label renders muted`
        );
      }
    });

    test("mise private tasks sort after public ones and render muted", async function () {
      this.timeout(15000);

      const items = await getItemsForFile("mise", miseRelativePath);
      const labels = items.map((item) => getLabelString(item.label));
      const folderChildren = await getFolderChildrenForCategory("Mise Tasks", "private-targets");
      const folderLabels = folderChildren.map((item) => getLabelString(item.label));

      assert.deepStrictEqual(
        folderLabels,
        [...publicLabels, ...privateLabels],
        "Mise tasks should keep public tasks first without rendering a divider row"
      );

      assert.deepStrictEqual(
        labels,
        [...publicLabels, ...privateLabels],
        "Mise tasks should keep public tasks first and move _-prefixed private tasks below them"
      );

      const privateItems = items.filter((item) => privateLabels.includes(getLabelString(item.label)));
      assert.strictEqual(privateItems.length, privateLabels.length, "Should find all private mise tasks");

      for (const item of privateItems) {
        const description = typeof item.description === "string" ? item.description : "";
        assert.ok(
          description.includes("private"),
          `Private mise task ${getLabelString(item.label)} should be visibly marked as private`
        );
        assert.strictEqual(
          getThemeColorId(item),
          "descriptionForeground",
          `Private mise task ${getLabelString(item.label)} should use a muted icon color`
        );
        assert.strictEqual(
          item.resourceUri?.scheme,
          "commandtree-private",
          `Private mise task ${getLabelString(item.label)} must carry a private resourceUri so the label renders muted`
        );
      }
    });
  });

  suite("Make Target Conventions", () => {
    const makeRelativePath = "make-conventions/Makefile";

    async function getFolderChildrenForCategory(
      categoryLabel: string,
      folderLabel: string
    ): Promise<CommandTreeItem[]> {
      const provider = getCommandTreeProvider();
      const categories = await provider.getChildren();
      const category = categories.find((item) => getLabelString(item.label).includes(categoryLabel));
      assert.ok(category !== undefined, `Should find category ${categoryLabel}`);

      const children = await provider.getChildren(category);
      const folder = children.find((item) => getLabelString(item.label) === folderLabel);
      assert.ok(folder !== undefined, `Should find folder ${folderLabel}`);

      return await provider.getChildren(folder);
    }

    async function getMakeItemsForFile(relativePath: string): Promise<CommandTreeItem[]> {
      const provider = getCommandTreeProvider();
      const items = await collectLeafItems(provider);
      return items.filter(
        (item) => isCommandItem(item.data) && item.data.type === "make" && item.data.filePath.endsWith(relativePath)
      );
    }

    setup(async function () {
      this.timeout(15000);

      writeFile(
        makeRelativePath,
        [
          ".PHONY: help build _private",
          "",
          "aaa_file:",
          '\t@echo "file target"',
          "",
          "help:",
          '\t@echo "help target"',
          "",
          "build:",
          '\t@echo "build target"',
          "",
          "%.o: %.c",
          '\t@echo "pattern rule"',
          "",
          ".DEFAULT:",
          '\t@echo "special target"',
          "",
          "_private:",
          '\t@echo "private target"',
        ].join("\n")
      );

      await refreshTasks();
    });

    teardown(async function () {
      this.timeout(15000);
      deleteFile(makeRelativePath);
      await refreshTasks();
    });

    test("make targets sort alphabetically, private targets sort last, and special targets stay hidden", async function () {
      this.timeout(15000);

      const folderChildren = await getFolderChildrenForCategory("Make Targets", "make-conventions");
      const folderLabels = folderChildren.map((item) => getLabelString(item.label));
      const items = await getMakeItemsForFile(makeRelativePath);
      const labels = items.map((item) => getLabelString(item.label));

      assert.deepStrictEqual(
        folderLabels,
        ["aaa_file", "build", "help", "_private"],
        "Make targets should sort alphabetically, keep private targets last, and avoid divider rows"
      );

      assert.deepStrictEqual(
        labels,
        ["aaa_file", "build", "help", "_private"],
        "Only invokable make targets should remain after hiding special and pattern rules"
      );

      assert.ok(!labels.includes("%.o"), "Pattern rules should be hidden from Make discovery");
      assert.ok(!labels.includes(".DEFAULT"), "Dot-prefixed special targets should be hidden from Make discovery");
    });
  });
});
