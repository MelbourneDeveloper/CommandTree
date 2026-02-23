import * as vscode from "vscode";
import type { CommandItem, CommandType, IconDef } from "../models/TaskItem";
import { CommandTreeItem } from "../models/TaskItem";
import { ICON_REGISTRY } from "../discovery";

const DEFAULT_FOLDER_ICON = new vscode.ThemeIcon("folder");

function toThemeIcon(def: IconDef): vscode.ThemeIcon {
  return new vscode.ThemeIcon(def.icon, new vscode.ThemeColor(def.color));
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
  md.appendMarkdown(`Type: \`${task.type}\`\n\n`);
  md.appendMarkdown(`Command: \`${task.command}\`\n\n`);
  if (task.cwd !== undefined && task.cwd !== "") {
    md.appendMarkdown(`Working Dir: \`${task.cwd}\`\n\n`);
  }
  if (task.tags.length > 0) {
    md.appendMarkdown(
      `Tags: ${task.tags.map((t) => `\`${t}\``).join(", ")}\n\n`,
    );
  }
  md.appendMarkdown(`Source: \`${task.filePath}\``);
  return md;
}

function buildDescription(task: CommandItem): string {
  const tagStr = task.tags.length > 0 ? ` [${task.tags.join(", ")}]` : "";
  return `${task.category}${tagStr}`;
}

export function createCommandNode(task: CommandItem): CommandTreeItem {
  return new CommandTreeItem({
    label: task.label,
    data: task,
    children: [],
    id: task.id,
    contextValue: resolveContextValue(task),
    tooltip: buildTooltip(task),
    iconPath: toThemeIcon(ICON_REGISTRY[task.type]),
    description: buildDescription(task),
    command: {
      command: "vscode.open",
      title: "Open File",
      arguments: [vscode.Uri.file(task.filePath)],
    },
  });
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
