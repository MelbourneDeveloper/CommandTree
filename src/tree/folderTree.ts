import type { CommandItem } from "../models/TaskItem";
import type { CommandTreeItem } from "../models/TaskItem";
import type { DirNode } from "./dirTree";
import { groupByFullDir, buildDirTree, needsFolderWrapper, getFolderLabel } from "./dirTree";
import { createFolderNode, createTaskNodes } from "./nodeFactory";

interface RootItemBuckets {
  readonly folders: CommandTreeItem[];
  readonly tasks: CommandItem[];
}

/**
 * Renders a DirNode as a folder CommandTreeItem.
 */
function renderFolder({
  node,
  parentDir,
  parentTreeId,
  sortTasks,
}: {
  node: DirNode<CommandItem>;
  parentDir: string;
  parentTreeId: string;
  sortTasks: (tasks: CommandItem[]) => CommandItem[];
}): CommandTreeItem {
  const label = getFolderLabel(node.dir, parentDir);
  const folderId = `${parentTreeId}/${label}`;
  const taskItems = createTaskNodes(sortTasks(node.tasks));
  const subItems = node.subdirs.map((sub) =>
    renderFolder({
      node: sub,
      parentDir: node.dir,
      parentTreeId: folderId,
      sortTasks,
    })
  );
  return createFolderNode({
    label,
    children: [...subItems, ...taskItems],
    parentId: parentTreeId,
  });
}

function renderRootSubdirs({
  node,
  categoryId,
  sortTasks,
}: {
  node: DirNode<CommandItem>;
  categoryId: string;
  sortTasks: (tasks: CommandItem[]) => CommandItem[];
}): CommandTreeItem[] {
  return node.subdirs.map((sub) =>
    renderFolder({
      node: sub,
      parentDir: "",
      parentTreeId: categoryId,
      sortTasks,
    })
  );
}

function collectRootNodeItems({
  node,
  totalRootNodes,
  categoryId,
  sortTasks,
  buckets,
}: {
  node: DirNode<CommandItem>;
  totalRootNodes: number;
  categoryId: string;
  sortTasks: (tasks: CommandItem[]) => CommandItem[];
  buckets: RootItemBuckets;
}): void {
  if (node.dir === "") {
    buckets.folders.push(...renderRootSubdirs({ node, categoryId, sortTasks }));
    buckets.tasks.push(...node.tasks);
  } else if (needsFolderWrapper(node, totalRootNodes)) {
    buckets.folders.push(renderFolder({ node, parentDir: "", parentTreeId: categoryId, sortTasks }));
  } else {
    buckets.tasks.push(...node.tasks);
  }
}

/**
 * Builds nested folder tree items from a flat list of tasks.
 */
export function buildNestedFolderItems({
  tasks,
  workspaceRoot,
  categoryId,
  sortTasks,
}: {
  tasks: CommandItem[];
  workspaceRoot: string;
  categoryId: string;
  sortTasks: (tasks: CommandItem[]) => CommandItem[];
}): CommandTreeItem[] {
  const groups = groupByFullDir(tasks, workspaceRoot);
  const rootNodes = buildDirTree(groups);
  const buckets: RootItemBuckets = { folders: [], tasks: [] };

  for (const node of rootNodes) {
    collectRootNodeItems({ node, totalRootNodes: rootNodes.length, categoryId, sortTasks, buckets });
  }

  return [...buckets.folders, ...createTaskNodes(sortTasks(buckets.tasks))];
}
