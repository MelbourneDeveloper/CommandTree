import * as vscode from "vscode";
import * as path from "path";
export type { Result, Ok, Err } from "./Result";
export { ok, err } from "./Result";

/**
 * Icon definition for a command type. Plain data — no VS Code dependency.
 */
export interface IconDef {
  readonly icon: string;
  readonly color: string;
}

/**
 * Category definition for a command type. Defined by each discovery module.
 */
export interface CategoryDef {
  readonly type: CommandType;
  readonly label: string;
  readonly flat?: boolean;
}

/**
 * Command type identifiers.
 */
export type CommandType =
  | "shell"
  | "npm"
  | "make"
  | "launch"
  | "vscode"
  | "python"
  | "powershell"
  | "gradle"
  | "cargo"
  | "maven"
  | "ant"
  | "just"
  | "taskfile"
  | "deno"
  | "rake"
  | "composer"
  | "docker"
  | "dotnet"
  | "markdown"
  | "csharp-script"
  | "fsharp-script"
  | "mise";

/**
 * Parameter format types for flexible argument handling across different tools.
 */
export type ParamFormat =
  | "positional" // Append as quoted arg: "value"
  | "flag" // Append as flag: --flag "value"
  | "flag-equals" // Append as flag with equals: --flag=value
  | "dashdash-args"; // Prepend with --: -- value1 value2

/**
 * Parameter definition for commands requiring input.
 */
export interface ParamDef {
  readonly name: string;
  readonly description?: string;
  readonly default?: string;
  readonly options?: readonly string[];
  readonly format?: ParamFormat;
  readonly flag?: string;
}

/**
 * Mutable parameter definition for building during discovery.
 */
export interface MutableParamDef {
  name: string;
  description?: string;
  default?: string;
  options?: string[];
  format?: ParamFormat;
  flag?: string;
}

/**
 * Represents a discovered command.
 */
export interface CommandItem {
  readonly id: string;
  readonly label: string;
  readonly type: CommandType;
  readonly category: string;
  readonly command: string;
  readonly cwd?: string;
  readonly filePath: string;
  readonly tags: readonly string[];
  readonly params?: readonly ParamDef[];
  readonly description?: string;
  readonly summary?: string;
  readonly securityWarning?: string;
  readonly isPhony?: boolean;
  readonly line?: number;
}

/**
 * Mutable command item for building during discovery.
 */
export interface MutableCommandItem {
  id: string;
  label: string;
  type: CommandType;
  category: string;
  command: string;
  cwd?: string;
  filePath: string;
  tags: string[];
  params?: ParamDef[];
  description?: string;
  summary?: string;
  securityWarning?: string;
  isPhony?: boolean;
  line?: number;
}

/**
 * A top-level grouping node (e.g., "Shell Scripts (5)").
 */
export interface CategoryNode {
  readonly nodeType: "category";
  readonly commandType: CommandType;
}

/**
 * A directory or logical container node (e.g., `scripts/`).
 */
export interface FolderNode {
  readonly nodeType: "folder";
}

/**
 * Union of all node data types. CommandItem = command leaf, CategoryNode/FolderNode = containers.
 */
export type NodeData = CommandItem | CategoryNode | FolderNode;

/**
 * Type guard: true when data is a CommandItem (command leaf).
 */
export function isCommandItem(data: NodeData | null | undefined): data is CommandItem {
  return data !== null && data !== undefined && !("nodeType" in data);
}

/**
 * Pre-computed display properties for a CommandTreeItem.
 */
export interface CommandTreeItemProps {
  readonly label: string;
  readonly data: NodeData;
  readonly children: CommandTreeItem[];
  readonly id: string;
  readonly contextValue: string;
  readonly iconPath?: vscode.ThemeIcon;
  readonly tooltip?: vscode.MarkdownString;
  readonly description?: string;
  readonly command?: vscode.Command;
}

/**
 * Tree node for the CommandTree view. Dumb data container — no logic.
 */
export class CommandTreeItem extends vscode.TreeItem {
  public readonly data: NodeData;
  public readonly children: CommandTreeItem[];

  public constructor(props: CommandTreeItemProps) {
    super(
      props.label,
      props.children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );
    this.data = props.data;
    this.children = props.children;
    this.id = props.id;
    this.contextValue = props.contextValue;
    if (props.iconPath !== undefined) {
      this.iconPath = props.iconPath;
    }
    if (props.tooltip !== undefined) {
      this.tooltip = props.tooltip;
    }
    if (props.description !== undefined) {
      this.description = props.description;
    }
    if (props.command !== undefined) {
      this.command = props.command;
    }
  }
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

export function isPhonyTask(task: CommandItem): boolean {
  return task.type === "make" && task.isPhony === true;
}
