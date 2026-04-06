import * as vscode from "vscode";
import type { CommandItem, MutableCommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId } from "../models/TaskItem";

export const ICON_DEF: IconDef = { icon: "gear", color: "terminal.ansiBlue" };
export const CATEGORY_DEF: CategoryDef = {
  type: "vscode",
  label: "VS Code Tasks",
  flat: true,
};

/**
 * SPEC: [DISC-TASKS], [DISC-PARSE-STRATEGY]
 *
 * Discovers VS Code tasks using the built-in task provider API.
 * VS Code handles JSONC parsing, variable substitution, and input prompts.
 */
export async function discoverVsCodeTasks(workspaceRoot: string, _excludePatterns: string[]): Promise<CommandItem[]> {
  const allTasks = await vscode.tasks.fetchTasks();
  return allTasks.flatMap((task) => taskToCommandItem(task, workspaceRoot));
}

function taskToCommandItem(task: vscode.Task, workspaceRoot: string): CommandItem[] {
  const label = task.name;
  if (label === "") {
    return [];
  }

  const filePath = resolveTaskFilePath(task);
  const item: MutableCommandItem = {
    id: generateCommandId("vscode", filePath, label),
    label,
    type: "vscode",
    category: "VS Code Tasks",
    command: label,
    cwd: workspaceRoot,
    filePath,
    tags: [],
  };
  if (task.detail !== undefined && task.detail !== "") {
    item.description = task.detail;
  }
  return [item];
}

function resolveTaskFilePath(task: vscode.Task): string {
  const folder = task.scope;
  if (folder !== undefined && typeof folder === "object" && "uri" in folder) {
    return vscode.Uri.joinPath(folder.uri, ".vscode", "tasks.json").fsPath;
  }
  return "";
}
