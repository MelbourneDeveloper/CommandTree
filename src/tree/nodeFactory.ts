import * as vscode from 'vscode';
import type { TaskItem, TaskType, IconDef } from '../models/TaskItem';
import { CommandTreeItem } from '../models/TaskItem';
import { ICON_REGISTRY } from '../discovery';

const DEFAULT_FOLDER_ICON = new vscode.ThemeIcon('folder');

function toThemeIcon(def: IconDef): vscode.ThemeIcon {
    return new vscode.ThemeIcon(def.icon, new vscode.ThemeColor(def.color));
}

function resolveContextValue(task: TaskItem): string {
    const isQuick = task.tags.includes('quick');
    const isMarkdown = task.type === 'markdown';
    if (isMarkdown && isQuick) { return 'task-markdown-quick'; }
    if (isMarkdown) { return 'task-markdown'; }
    if (isQuick) { return 'task-quick'; }
    return 'task';
}

function buildTooltip(task: TaskItem): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${task.label}**\n\n`);
    md.appendMarkdown(`Type: \`${task.type}\`\n\n`);
    md.appendMarkdown(`Command: \`${task.command}\`\n\n`);
    if (task.cwd !== undefined && task.cwd !== '') {
        md.appendMarkdown(`Working Dir: \`${task.cwd}\`\n\n`);
    }
    if (task.tags.length > 0) {
        md.appendMarkdown(`Tags: ${task.tags.map(t => `\`${t}\``).join(', ')}\n\n`);
    }
    md.appendMarkdown(`Source: \`${task.filePath}\``);
    return md;
}

function buildDescription(task: TaskItem): string {
    const tagStr = task.tags.length > 0 ? ` [${task.tags.join(', ')}]` : '';
    return `${task.category}${tagStr}`;
}

export function createTaskNode(task: TaskItem): CommandTreeItem {
    return new CommandTreeItem({
        task,
        categoryLabel: null,
        children: [],
        id: task.id,
        contextValue: resolveContextValue(task),
        tooltip: buildTooltip(task),
        iconPath: toThemeIcon(ICON_REGISTRY[task.type]),
        description: buildDescription(task),
        command: {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [vscode.Uri.file(task.filePath)],
        },
    });
}

export function createCategoryNode({
    label,
    children,
    parentId,
    type,
}: {
    label: string;
    children: CommandTreeItem[];
    parentId?: string;
    type?: TaskType;
}): CommandTreeItem {
    const id = parentId !== undefined ? `${parentId}/${label}` : label;
    const iconPath = type !== undefined
        ? toThemeIcon(ICON_REGISTRY[type])
        : DEFAULT_FOLDER_ICON;
    return new CommandTreeItem({
        task: null,
        categoryLabel: label,
        children,
        id,
        contextValue: 'category',
        iconPath,
    });
}

export function createPlaceholderNode(message: string): CommandTreeItem {
    return new CommandTreeItem({
        task: null,
        categoryLabel: message,
        children: [],
        id: message,
        contextValue: 'placeholder',
    });
}
