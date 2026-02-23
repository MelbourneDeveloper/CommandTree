import type { TaskItem } from '../models/TaskItem';
import type { CommandTreeItem } from '../models/TaskItem';
import type { DirNode } from './dirTree';
import {
    groupByFullDir,
    buildDirTree,
    needsFolderWrapper,
    getFolderLabel
} from './dirTree';
import { createTaskNode, createCategoryNode } from './nodeFactory';

/**
 * Renders a DirNode as a folder CommandTreeItem.
 */
function renderFolder({
    node,
    parentDir,
    parentTreeId,
    sortTasks
}: {
    node: DirNode<TaskItem>;
    parentDir: string;
    parentTreeId: string;
    sortTasks: (tasks: TaskItem[]) => TaskItem[];
}): CommandTreeItem {
    const label = getFolderLabel(node.dir, parentDir);
    const folderId = `${parentTreeId}/${label}`;
    const taskItems = sortTasks(node.tasks).map(t => createTaskNode(t));
    const subItems = node.subdirs.map(sub => renderFolder({
        node: sub,
        parentDir: node.dir,
        parentTreeId: folderId,
        sortTasks
    }));
    return createCategoryNode({
        label,
        children: [...subItems, ...taskItems],
        parentId: parentTreeId,
    });
}

/**
 * Builds nested folder tree items from a flat list of tasks.
 */
export function buildNestedFolderItems({
    tasks,
    workspaceRoot,
    categoryId,
    sortTasks
}: {
    tasks: TaskItem[];
    workspaceRoot: string;
    categoryId: string;
    sortTasks: (tasks: TaskItem[]) => TaskItem[];
}): CommandTreeItem[] {
    const groups = groupByFullDir(tasks, workspaceRoot);
    const rootNodes = buildDirTree(groups);
    const result: CommandTreeItem[] = [];

    for (const node of rootNodes) {
        if (node.dir === '') {
            for (const sub of node.subdirs) {
                result.push(renderFolder({
                    node: sub,
                    parentDir: '',
                    parentTreeId: categoryId,
                    sortTasks
                }));
            }
            result.push(...sortTasks(node.tasks).map(t => createTaskNode(t)));
        } else if (needsFolderWrapper(node, rootNodes.length)) {
            result.push(renderFolder({
                node,
                parentDir: '',
                parentTreeId: categoryId,
                sortTasks
            }));
        } else {
            result.push(...sortTasks(node.tasks).map(t => createTaskNode(t)));
        }
    }

    return result;
}
