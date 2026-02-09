import * as vscode from 'vscode';
import * as path from 'path';
import { CommandTreeProvider } from '../../CommandTreeProvider';
import { CommandTreeItem } from '../../models/TaskItem';
import type { TaskItem, TaskType } from '../../models/TaskItem';

export const EXTENSION_ID = 'nimblesite.commandtree';

export interface TestContext {
    extension: vscode.Extension<unknown>;
    workspaceRoot: string;
}

export async function activateExtension(): Promise<TestContext> {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    if (!extension) {
        throw new Error(`Extension ${EXTENSION_ID} not found`);
    }

    if (!extension.isActive) {
        await extension.activate();
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
    }

    const firstFolder = workspaceFolders[0];
    if (!firstFolder) {
        throw new Error('No workspace folder open');
    }

    return {
        extension,
        workspaceRoot: firstFolder.uri.fsPath
    };
}

export async function sleep(ms: number): Promise<void> {
    await new Promise<void>(resolve => { setTimeout(resolve, ms); });
}

export function getFixturePath(relativePath: string): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
    }
    const firstFolder = workspaceFolders[0];
    if (!firstFolder) {
        throw new Error('No workspace folder open');
    }
    return path.join(firstFolder.uri.fsPath, relativePath);
}

export function getExtensionPath(relativePath: string): string {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    if (!extension) {
        throw new Error(`Extension ${EXTENSION_ID} not found`);
    }
    return path.join(extension.extensionPath, relativePath);
}

export function getCommandTreeProvider(): CommandTreeProvider {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    if (extension === undefined) {
        throw new Error('Extension not found');
    }
    if (!extension.isActive) {
        throw new Error('Extension not active');
    }
    const extensionExports = extension.exports as { commandTreeProvider?: CommandTreeProvider } | undefined;
    const provider = extensionExports?.commandTreeProvider;
    if (!provider) {
        throw new Error('CommandTreeProvider not exported from extension');
    }
    return provider;
}

export async function getTreeChildren(provider: CommandTreeProvider, parent?: CommandTreeItem): Promise<CommandTreeItem[]> {
    return await provider.getChildren(parent);
}

export { CommandTreeProvider, CommandTreeItem };

export function getLabelString(label: string | vscode.TreeItemLabel | undefined): string {
    if (label === undefined) {
        return "";
    }
    if (typeof label === "string") {
        return label;
    }
    return label.label;
}

export async function collectLeafItems(
    p: CommandTreeProvider,
): Promise<CommandTreeItem[]> {
    const out: CommandTreeItem[] = [];
    async function walk(node: CommandTreeItem): Promise<void> {
        if (node.task !== null) {
            out.push(node);
        }
        for (const child of await p.getChildren(node)) {
            await walk(child);
        }
    }
    for (const root of await p.getChildren()) {
        await walk(root);
    }
    return out;
}

export async function collectLeafTasks(p: CommandTreeProvider): Promise<TaskItem[]> {
    const items = await collectLeafItems(p);
    return items.map((i) => i.task).filter((t): t is TaskItem => t !== null);
}

export function getTooltipText(item: CommandTreeItem): string {
    if (item.tooltip instanceof vscode.MarkdownString) {
        return item.tooltip.value;
    }
    if (typeof item.tooltip === "string") {
        return item.tooltip;
    }
    return "";
}

export function createMockTaskItem(overrides: Partial<{
    id: string;
    label: string;
    type: TaskType;
    command: string;
    cwd: string;
    filePath: string;
    category: string;
    description: string;
    params: Array<{ name: string; description: string; default?: string; options?: string[] }>;
    tags: string[];
}> = {}): TaskItem {
    const base = {
        id: overrides.id ?? 'test-task-id',
        label: overrides.label ?? 'Test Command',
        type: overrides.type ?? 'shell',
        command: overrides.command ?? 'echo test',
        filePath: overrides.filePath ?? '/tmp/test.sh',
        category: overrides.category ?? 'Test Category',
        description: overrides.description ?? 'A test command',
        params: overrides.params ?? [],
        tags: overrides.tags ?? []
    };
    return overrides.cwd !== undefined ? { ...base, cwd: overrides.cwd } : base;
}
