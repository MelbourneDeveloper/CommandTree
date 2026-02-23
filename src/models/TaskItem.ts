import * as vscode from 'vscode';
import * as path from 'path';
export type { Result, Ok, Err } from './Result';
export { ok, err } from './Result';

/**
 * Icon definition for a task type. Plain data — no VS Code dependency.
 */
export interface IconDef {
    readonly icon: string;
    readonly color: string;
}

/**
 * Command type identifiers.
 */
export type TaskType =
    | 'shell'
    | 'npm'
    | 'make'
    | 'launch'
    | 'vscode'
    | 'python'
    | 'powershell'
    | 'gradle'
    | 'cargo'
    | 'maven'
    | 'ant'
    | 'just'
    | 'taskfile'
    | 'deno'
    | 'rake'
    | 'composer'
    | 'docker'
    | 'dotnet'
    | 'markdown';

/**
 * Parameter format types for flexible argument handling across different tools.
 */
export type ParamFormat =
    | 'positional'       // Append as quoted arg: "value"
    | 'flag'             // Append as flag: --flag "value"
    | 'flag-equals'      // Append as flag with equals: --flag=value
    | 'dashdash-args';   // Prepend with --: -- value1 value2

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
export interface TaskItem {
    readonly id: string;
    readonly label: string;
    readonly type: TaskType;
    readonly category: string;
    readonly command: string;
    readonly cwd?: string;
    readonly filePath: string;
    readonly tags: readonly string[];
    readonly params?: readonly ParamDef[];
    readonly description?: string;
}

/**
 * Mutable command item for building during discovery.
 */
export interface MutableTaskItem {
    id: string;
    label: string;
    type: TaskType;
    category: string;
    command: string;
    cwd?: string;
    filePath: string;
    tags: string[];
    params?: ParamDef[];
    description?: string;
}

/**
 * Pre-computed display properties for a CommandTreeItem.
 */
export interface CommandTreeItemProps {
    readonly task: TaskItem | null;
    readonly categoryLabel: string | null;
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
    public readonly task: TaskItem | null;
    public readonly categoryLabel: string | null;
    public readonly children: CommandTreeItem[];

    constructor(props: CommandTreeItemProps) {
        super(
            props.task?.label ?? props.categoryLabel ?? '',
            props.children.length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );
        this.task = props.task;
        this.categoryLabel = props.categoryLabel;
        this.children = props.children;
        this.id = props.id;
        this.contextValue = props.contextValue;
        if (props.iconPath !== undefined) { this.iconPath = props.iconPath; }
        if (props.tooltip !== undefined) { this.tooltip = props.tooltip; }
        if (props.description !== undefined) { this.description = props.description; }
        if (props.command !== undefined) { this.command = props.command; }
    }
}

/**
 * Simplifies a file path to a readable category.
 */
export function simplifyPath(filePath: string, workspaceRoot: string): string {
    const relative = path.relative(workspaceRoot, path.dirname(filePath));
    if (relative === '' || relative === '.') {
        return 'Root';
    }

    const parts = relative.split(path.sep);
    if (parts.length > 3) {
        const first = parts[0];
        const last = parts[parts.length - 1];
        if (first !== undefined && last !== undefined) {
            return `${first}/.../${last}`;
        }
    }
    return relative.replace(/\\/g, '/');
}

/**
 * Generates a unique ID for a command.
 */
export function generateTaskId(type: TaskType, filePath: string, name: string): string {
    return `${type}:${filePath}:${name}`;
}
