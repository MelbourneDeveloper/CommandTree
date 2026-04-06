# Tree View

**SPEC-TREE-001**

The tree view is generated **directly from the file system** by parsing package.json, Makefiles, shell scripts, etc. The SQLite database **enriches** the tree with AI-generated summaries but is not the source of truth.

## Click Behavior

**SPEC-TREE-010**

Clicking a task item in the tree opens the file in the editor. It does NOT run the command. Running is done via explicit play button or context menu.

### Test Coverage
- [treeview.e2e.test.ts](../src/test/e2e/treeview.e2e.test.ts): "clicking a task item opens the file in editor, NOT runs it", "click command points to the task file path"

## Folder Hierarchy

**SPEC-TREE-020**

Tasks are grouped by folder. Root-level items appear directly under their category without an extra "Root" folder node. Folders always appear before files in the tree.

### Test Coverage
- [treeview.e2e.test.ts](../src/test/e2e/treeview.e2e.test.ts): "root-level items appear directly under category — no Root folder node", "folders must come before files in tree — normal file/folder rules"
- [treehierarchy.unit.test.ts](../src/test/unit/treehierarchy.unit.test.ts): "single task in single folder should NOT create folder node", "multiple tasks in single folder should create folder node", "parent/child directories should be properly nested", "unrelated directories should remain flat siblings", "deep nesting with intermediate tasks is handled correctly", "needsFolderWrapper returns true when node has subdirs", "needsFolderWrapper returns false for single task among multiple roots"

## Folder Grouping

**SPEC-TREE-030**

Tasks are grouped by their full directory path. The `groupByFullDir` function maps tasks to their containing directory. Empty directories still appear in the tree if they have subdirectories with tasks.

### Test Coverage
- [treehierarchy.unit.test.ts](../src/test/unit/treehierarchy.unit.test.ts): "task at workspace root gets empty string key", "buildDirTree with empty groups returns empty array", "dir with no direct tasks still appears in tree"

## Directory Label Simplification

**SPEC-TREE-040**

Long directory paths are simplified for display. Paths with more than 3 parts are abbreviated. The `getFolderLabel` function computes relative labels when a parent directory is known.

### Test Coverage
- [treehierarchy.unit.test.ts](../src/test/unit/treehierarchy.unit.test.ts): "returns Root for empty string", "returns Root for dot", "returns path as-is for short paths", "returns path as-is for exactly 3 parts", "simplifies paths with more than 3 parts", "simplifies deeply nested paths", "returns simplified label when parentDir is empty", "returns relative part after parent", "returns nested relative part"
