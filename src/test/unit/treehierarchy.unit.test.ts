import * as assert from "assert";
import * as path from "path";
import type { CommandItem } from "../../models/TaskItem";
import { groupByFullDir, buildDirTree, needsFolderWrapper, simplifyDirLabel, getFolderLabel } from "../../tree/dirTree";

/**
 * TODO: No corresponding section in spec
 * PURE UNIT TESTS for tree hierarchy building logic.
 * Tests the folder nesting behavior from src/tree/folderTree.ts.
 * NO VS Code - tests pure functions only.
 */
// TODO: No corresponding section in spec
suite("Tree Hierarchy Unit Tests", function () {
  this.timeout(10000);

  const WORKSPACE = "/workspace";

  function createMockTask(overrides: Partial<CommandItem>): CommandItem {
    const base: CommandItem = {
      id: "shell:/workspace/script.sh:run",
      label: "run",
      type: "shell",
      command: "./run.sh",
      cwd: "/workspace",
      filePath: "/workspace/script.sh",
      category: "Root",
      tags: [],
    };

    if (overrides.description !== undefined) {
      return { ...base, ...overrides, description: overrides.description };
    }

    const restOverrides = { ...overrides };
    delete (restOverrides as { description?: string }).description;
    return { ...base, ...restOverrides };
  }

  // TODO: No corresponding section in spec
  suite("Folder grouping", () => {
    test("single task in single folder should NOT create folder node", () => {
      const tasks = [
        createMockTask({
          label: "start.sh",
          filePath: path.join(WORKSPACE, "Samples", "start.sh"),
        }),
      ];

      const groups = groupByFullDir(tasks, WORKSPACE);
      const tree = buildDirTree(groups);

      assert.strictEqual(tree.length, 1, "Should have 1 root node");
      const node = tree[0];
      assert.ok(node !== undefined);
      assert.strictEqual(
        needsFolderWrapper(node, 1),
        false,
        "Single task in single folder should not need folder wrapper"
      );
    });

    test("multiple tasks in single folder should create folder node", () => {
      const tasks = [
        createMockTask({
          id: "a",
          label: "start.sh",
          filePath: path.join(WORKSPACE, "Samples", "deps", "start.sh"),
        }),
        createMockTask({
          id: "b",
          label: "stop.sh",
          filePath: path.join(WORKSPACE, "Samples", "deps", "stop.sh"),
        }),
      ];

      const groups = groupByFullDir(tasks, WORKSPACE);
      const tree = buildDirTree(groups);

      assert.strictEqual(tree.length, 1, "Should have 1 root node");
      const node = tree[0];
      assert.ok(node !== undefined);
      assert.strictEqual(node.tasks.length, 2, "Folder should contain 2 tasks");
      assert.strictEqual(needsFolderWrapper(node, 1), true, "Multiple tasks should need folder wrapper");
    });

    test("parent/child directories should be properly nested", () => {
      // This is the exact bug scenario:
      // import.sh is in Samples/ICD10/scripts/CreateDb
      // start.sh + stop.sh are in Samples/ICD10/scripts/CreateDb/Dependencies
      // BUG: they were flat siblings. FIX: Dependencies nests inside CreateDb
      const tasks = [
        createMockTask({
          id: "shell:import",
          label: "import.sh",
          filePath: path.join(WORKSPACE, "Samples", "ICD10", "scripts", "CreateDb", "import.sh"),
        }),
        createMockTask({
          id: "shell:start",
          label: "start.sh",
          filePath: path.join(WORKSPACE, "Samples", "ICD10", "scripts", "CreateDb", "Dependencies", "start.sh"),
        }),
        createMockTask({
          id: "shell:stop",
          label: "stop.sh",
          filePath: path.join(WORKSPACE, "Samples", "ICD10", "scripts", "CreateDb", "Dependencies", "stop.sh"),
        }),
      ];

      const groups = groupByFullDir(tasks, WORKSPACE);
      const tree = buildDirTree(groups);

      // CreateDb should be the only root node
      assert.strictEqual(tree.length, 1, "Should have 1 root node (CreateDb)");
      const createDb = tree[0];
      assert.ok(createDb !== undefined);
      assert.ok(createDb.dir.endsWith("CreateDb"), `Root dir should be CreateDb, got: ${createDb.dir}`);
      assert.strictEqual(createDb.tasks.length, 1, "CreateDb should have import.sh");
      assert.strictEqual(createDb.tasks[0]?.label, "import.sh");

      // Dependencies should be a CHILD of CreateDb, not a sibling
      assert.strictEqual(createDb.subdirs.length, 1, "CreateDb should have 1 subdir");
      const deps = createDb.subdirs[0];
      assert.ok(deps !== undefined);
      assert.ok(deps.dir.endsWith("Dependencies"), `Subdir should be Dependencies, got: ${deps.dir}`);
      assert.strictEqual(deps.tasks.length, 2, "Dependencies should have 2 tasks");
    });

    test("unrelated directories should remain flat siblings", () => {
      const tasks = [
        createMockTask({
          id: "a",
          label: "build.sh",
          filePath: path.join(WORKSPACE, "Samples", "build", "build.sh"),
        }),
        createMockTask({
          id: "b",
          label: "deploy.sh",
          filePath: path.join(WORKSPACE, "Samples", "deploy", "deploy.sh"),
        }),
        createMockTask({
          id: "c",
          label: "test.sh",
          filePath: path.join(WORKSPACE, "Other", "test", "test.sh"),
        }),
      ];

      const groups = groupByFullDir(tasks, WORKSPACE);
      const tree = buildDirTree(groups);

      // All in different unrelated dirs, should be 3 root nodes
      assert.strictEqual(tree.length, 3, "Should have 3 root nodes for unrelated dirs");
      for (const node of tree) {
        assert.strictEqual(node.subdirs.length, 0, "Unrelated dirs should have no subdirs");
      }
    });

    test("deep nesting with intermediate tasks is handled correctly", () => {
      const tasks = [
        createMockTask({
          id: "root",
          label: "root.sh",
          filePath: path.join(WORKSPACE, "src", "root.sh"),
        }),
        createMockTask({
          id: "mid",
          label: "mid.sh",
          filePath: path.join(WORKSPACE, "src", "lib", "mid.sh"),
        }),
        createMockTask({
          id: "deep",
          label: "deep.sh",
          filePath: path.join(WORKSPACE, "src", "lib", "utils", "deep.sh"),
        }),
      ];

      const groups = groupByFullDir(tasks, WORKSPACE);
      const tree = buildDirTree(groups);

      // src is root, lib is child, utils is grandchild
      assert.strictEqual(tree.length, 1, "Should have 1 root (src)");
      const src = tree[0];
      assert.ok(src !== undefined);
      assert.strictEqual(src.tasks.length, 1, "src should have root.sh");

      const lib = src.subdirs[0];
      assert.ok(lib !== undefined);
      assert.strictEqual(lib.tasks.length, 1, "lib should have mid.sh");

      const utils = lib.subdirs[0];
      assert.ok(utils !== undefined);
      assert.strictEqual(utils.tasks.length, 1, "utils should have deep.sh");
    });

    test("needsFolderWrapper returns true when node has subdirs", () => {
      const tasks = [
        createMockTask({
          id: "parent",
          label: "parent.sh",
          filePath: path.join(WORKSPACE, "src", "parent.sh"),
        }),
        createMockTask({
          id: "child",
          label: "child.sh",
          filePath: path.join(WORKSPACE, "src", "sub", "child.sh"),
        }),
      ];
      const groups = groupByFullDir(tasks, WORKSPACE);
      const tree = buildDirTree(groups);
      const src = tree[0];
      assert.ok(src !== undefined);
      assert.strictEqual(needsFolderWrapper(src, 1), true, "Node with subdirs needs folder wrapper");
    });

    test("needsFolderWrapper returns false for single task among multiple roots", () => {
      const tasks = [
        createMockTask({
          id: "a",
          label: "a.sh",
          filePath: path.join(WORKSPACE, "dirA", "a.sh"),
        }),
        createMockTask({
          id: "b",
          label: "b.sh",
          filePath: path.join(WORKSPACE, "dirB", "b.sh"),
        }),
      ];
      const groups = groupByFullDir(tasks, WORKSPACE);
      const tree = buildDirTree(groups);
      assert.strictEqual(tree.length, 2);
      const node = tree[0];
      assert.ok(node !== undefined);
      assert.strictEqual(needsFolderWrapper(node, 2), false, "Single task with multiple roots = no wrapper");
    });
  });

  suite("groupByFullDir edge cases", () => {
    test("task at workspace root gets empty string key", () => {
      const tasks = [
        createMockTask({
          id: "root-task",
          label: "root.sh",
          filePath: path.join(WORKSPACE, "root.sh"),
        }),
      ];
      const groups = groupByFullDir(tasks, WORKSPACE);
      assert.ok(groups.has(""), "Root-level task should map to empty string key");
      assert.strictEqual(groups.get("")?.length, 1);
    });

    test("buildDirTree with empty groups returns empty array", () => {
      const groups = new Map<string, CommandItem[]>();
      const tree = buildDirTree(groups);
      assert.strictEqual(tree.length, 0, "Empty groups should produce empty tree");
    });

    test("dir with no direct tasks still appears in tree", () => {
      const tasks = [
        createMockTask({
          id: "deep",
          label: "deep.sh",
          filePath: path.join(WORKSPACE, "a", "b", "deep.sh"),
        }),
      ];
      const groups = groupByFullDir(tasks, WORKSPACE);
      const tree = buildDirTree(groups);
      assert.strictEqual(tree.length, 1);
      const node = tree[0];
      assert.ok(node !== undefined);
      assert.strictEqual(node.tasks.length, 1);
    });
  });

  suite("simplifyDirLabel", () => {
    test("returns Root for empty string", () => {
      assert.strictEqual(simplifyDirLabel(""), "Root");
    });

    test("returns Root for dot", () => {
      assert.strictEqual(simplifyDirLabel("."), "Root");
    });

    test("returns path as-is for short paths", () => {
      assert.strictEqual(simplifyDirLabel("src/lib"), "src/lib");
    });

    test("returns path as-is for exactly 3 parts", () => {
      assert.strictEqual(simplifyDirLabel("src/lib/utils"), "src/lib/utils");
    });

    test("simplifies paths with more than 3 parts", () => {
      assert.strictEqual(simplifyDirLabel("src/lib/utils/helpers"), "src/.../helpers");
    });

    test("simplifies deeply nested paths", () => {
      assert.strictEqual(simplifyDirLabel("a/b/c/d/e/f"), "a/.../f");
    });
  });

  suite("getFolderLabel", () => {
    test("returns simplified label when parentDir is empty", () => {
      assert.strictEqual(getFolderLabel("src/lib", ""), "src/lib");
    });

    test("returns relative part after parent", () => {
      assert.strictEqual(getFolderLabel("src/lib/utils", "src/lib"), "utils");
    });

    test("returns nested relative part", () => {
      assert.strictEqual(getFolderLabel("a/b/c/d", "a/b"), "c/d");
    });
  });
});
