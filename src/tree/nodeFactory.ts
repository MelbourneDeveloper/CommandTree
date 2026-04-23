import * as vscode from "vscode";
import { isPrivateTask } from "../models/TaskItem";
import type { CommandItem, CommandType, IconDef } from "../models/TaskItem";
import { CommandTreeItem } from "../models/TaskItem";
import { ICON_REGISTRY } from "../discovery";
import { buildPrivateTaskUri } from "./PrivateTaskDecorationProvider";

const DEFAULT_FOLDER_ICON = new vscode.ThemeIcon("folder");
const PRIVATE_TASK_COLOR = new vscode.ThemeColor("descriptionForeground");

function toThemeIcon(def: IconDef): vscode.ThemeIcon {
  return new vscode.ThemeIcon(def.icon, new vscode.ThemeColor(def.color));
}

function getTaskIcon(task: CommandItem): vscode.ThemeIcon {
  if (isPrivateTask(task)) {
    return new vscode.ThemeIcon(ICON_REGISTRY[task.type].icon, PRIVATE_TASK_COLOR);
  }
  return toThemeIcon(ICON_REGISTRY[task.type]);
}

function resolveContextValue(task: CommandItem): string {
  const isQuick = task.tags.includes("quick");
  const isMarkdown = task.type === "markdown";
  if (isMarkdown && isQuick) {
    return "task-markdown-quick";
  }
  if (isMarkdown) {
    return "task-markdown";
  }
  if (isQuick) {
    return "task-quick";
  }
  return "task";
}

function buildTooltip(task: CommandItem): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.appendMarkdown(`**${task.label}**\n\n`);
  if (task.securityWarning !== undefined && task.securityWarning !== "") {
    md.appendMarkdown(`\u26A0\uFE0F **Security Warning:** ${task.securityWarning}\n\n`);
    md.appendMarkdown(`---\n\n`);
  }
  if (task.summary !== undefined && task.summary !== "") {
    md.appendMarkdown(`> ${task.summary}\n\n`);
    md.appendMarkdown(`---\n\n`);
  }
  md.appendMarkdown(`Type: \`${task.type}\`\n\n`);
  md.appendMarkdown(`Command: \`${task.command}\`\n\n`);
  if (task.cwd !== undefined && task.cwd !== "") {
    md.appendMarkdown(`Working Dir: \`${task.cwd}\`\n\n`);
  }
  if (task.tags.length > 0) {
    md.appendMarkdown(`Tags: ${task.tags.map((t) => `\`${t}\``).join(", ")}\n\n`);
  }
  md.appendMarkdown(`Source: \`${task.filePath}\``);
  return md;
}

function buildDescription(task: CommandItem): string {
  const privateMarker = isPrivateTask(task) ? " private" : "";
  const tagStr = task.tags.length > 0 ? ` [${task.tags.join(", ")}]` : "";
  return `${task.category}${privateMarker}${tagStr}`;
}

export function createCommandNode(task: CommandItem): CommandTreeItem {
  const hasWarning = task.securityWarning !== undefined && task.securityWarning !== "";
  const label = hasWarning ? `\u26A0\uFE0F ${task.label}` : task.label;
  return new CommandTreeItem({
    label,
    data: task,
    children: [],
    id: task.id,
    contextValue: resolveContextValue(task),
    tooltip: buildTooltip(task),
    iconPath: getTaskIcon(task),
    description: buildDescription(task),
    command: {
      command: "vscode.open",
      title: "Open File",
      arguments:
        task.line !== undefined
          ? [vscode.Uri.file(task.filePath), { selection: new vscode.Range(task.line - 1, 0, task.line - 1, 0) }]
          : [vscode.Uri.file(task.filePath)],
    },
    ...(isPrivateTask(task) ? { resourceUri: buildPrivateTaskUri(task.id) } : {}),
  });
}

export function createTaskNodes(tasks: CommandItem[]): CommandTreeItem[] {
  return tasks.map((task) => createCommandNode(task));
}

export function createCategoryNode({
  label,
  children,
  type,
}: {
  label: string;
  children: CommandTreeItem[];
  type: CommandType;
}): CommandTreeItem {
  return new CommandTreeItem({
    label,
    data: { nodeType: "category", commandType: type },
    children,
    id: label,
    contextValue: "category",
    iconPath: toThemeIcon(ICON_REGISTRY[type]),
  });
}

export function createFolderNode({
  label,
  children,
  parentId,
}: {
  label: string;
  children: CommandTreeItem[];
  parentId: string;
}): CommandTreeItem {
  return new CommandTreeItem({
    label,
    data: { nodeType: "folder" },
    children,
    id: `${parentId}/${label}`,
    contextValue: "category",
    iconPath: DEFAULT_FOLDER_ICON,
  });
}

export function createPlaceholderNode(message: string): CommandTreeItem {
  return new CommandTreeItem({
    label: message,
    data: { nodeType: "folder" },
    children: [],
    id: message,
    contextValue: "placeholder",
  });
}
