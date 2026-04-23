import * as path from "path";
import type { CommandItem, CommandType, NodeData } from "./TaskItem";

/**
 * Type guard: true when data is a CommandItem (command leaf).
 */
export function isCommandItem(data: NodeData | null | undefined): data is CommandItem {
  return data !== null && data !== undefined && !("nodeType" in data);
}

/**
 * Simplifies a file path to a readable category.
 */
export function simplifyPath(filePath: string, workspaceRoot: string): string {
  const relative = path.relative(workspaceRoot, path.dirname(filePath));
  if (relative === "" || relative === ".") {
    return "Root";
  }

  const parts = relative.split(path.sep);
  if (parts.length > 3) {
    const first = parts[0];
    const last = parts[parts.length - 1];
    if (first !== undefined && last !== undefined) {
      return `${first}/.../${last}`;
    }
  }
  return relative.split("\\").join("/");
}

/**
 * Generates a unique ID for a command.
 */
export function generateCommandId(type: CommandType, filePath: string, name: string): string {
  return `${type}:${filePath}:${name}`;
}

function supportsPrivateTaskStyling(type: CommandType): boolean {
  return type === "make" || type === "mise";
}

export function isPrivateTask(task: CommandItem): boolean {
  return supportsPrivateTaskStyling(task.type) && task.label.startsWith("_");
}
