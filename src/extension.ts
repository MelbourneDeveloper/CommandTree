import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CommandTreeProvider } from './CommandTreeProvider';
import { CommandTreeItem } from './models/TaskItem';
import type { TaskItem } from './models/TaskItem';
import { TaskRunner } from './runners/TaskRunner';
import { QuickTasksProvider } from './QuickTasksProvider';
import { logger } from './utils/logger';
import { initDb, getDb, disposeDb } from './db/lifecycle';
import { addTagToCommand, removeTagFromCommand, getCommandIdsByTag } from './db/db';

let treeProvider: CommandTreeProvider;
let quickTasksProvider: QuickTasksProvider;
let taskRunner: TaskRunner;

export interface ExtensionExports {
    commandTreeProvider: CommandTreeProvider;
    quickTasksProvider: QuickTasksProvider;
}

export async function activate(context: vscode.ExtensionContext): Promise<ExtensionExports | undefined> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    logger.info('Extension activating', { workspaceRoot });
    if (workspaceRoot === undefined || workspaceRoot === '') {
        logger.warn('No workspace root found, extension not activating');
        return;
    }
    initDatabase(workspaceRoot);
    treeProvider = new CommandTreeProvider(workspaceRoot);
    quickTasksProvider = new QuickTasksProvider();
    taskRunner = new TaskRunner();
    registerTreeViews(context);
    registerCommands(context);
    setupFileWatcher(context, workspaceRoot);
    await syncQuickTasks();
    await syncTagsFromJson(workspaceRoot);
    return { commandTreeProvider: treeProvider, quickTasksProvider };
}

function initDatabase(workspaceRoot: string): void {
    const result = initDb(workspaceRoot);
    if (!result.ok) {
        logger.warn('SQLite init failed', { error: result.error });
    }
}

function registerTreeViews(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.window.createTreeView('commandtree', {
            treeDataProvider: treeProvider,
            showCollapseAll: true
        }),
        vscode.window.createTreeView('commandtree-quick', {
            treeDataProvider: quickTasksProvider,
            showCollapseAll: true,
            dragAndDropController: quickTasksProvider
        })
    );
}

function registerCommands(context: vscode.ExtensionContext): void {
    registerCoreCommands(context);
    registerFilterCommands(context);
    registerTagCommands(context);
    registerQuickCommands(context);
}

function registerCoreCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('commandtree.refresh', async () => {
            await treeProvider.refresh();
            quickTasksProvider.updateTasks(treeProvider.getAllTasks());
            vscode.window.showInformationMessage('CommandTree refreshed');
        }),
        vscode.commands.registerCommand('commandtree.run', async (item: CommandTreeItem | undefined) => {
            if (item !== undefined && item.task !== null) {
                await taskRunner.run(item.task, 'newTerminal');
            }
        }),
        vscode.commands.registerCommand('commandtree.runInCurrentTerminal', async (item: CommandTreeItem | undefined) => {
            if (item !== undefined && item.task !== null) {
                await taskRunner.run(item.task, 'currentTerminal');
            }
        }),
        vscode.commands.registerCommand('commandtree.openPreview', async (item: CommandTreeItem | undefined) => {
            if (item !== undefined && item.task !== null && item.task.type === 'markdown') {
                await vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(item.task.filePath));
            }
        })
    );
}

function registerFilterCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('commandtree.filterByTag', handleFilterByTag),
        vscode.commands.registerCommand('commandtree.clearFilter', () => {
            treeProvider.clearFilters();
            updateFilterContext();
        })
    );
}

function registerTagCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('commandtree.addTag', handleAddTag),
        vscode.commands.registerCommand('commandtree.removeTag', handleRemoveTag)
    );
}

function registerQuickCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('commandtree.addToQuick', async (item: CommandTreeItem | TaskItem | undefined) => {
            const task = item instanceof CommandTreeItem ? item.task : item;
            if (task !== undefined && task !== null) {
                quickTasksProvider.addToQuick(task);
                await treeProvider.refresh();
                quickTasksProvider.updateTasks(treeProvider.getAllTasks());
            }
        }),
        vscode.commands.registerCommand('commandtree.removeFromQuick', async (item: CommandTreeItem | TaskItem | undefined) => {
            const task = item instanceof CommandTreeItem ? item.task : item;
            if (task !== undefined && task !== null) {
                quickTasksProvider.removeFromQuick(task);
                await treeProvider.refresh();
                quickTasksProvider.updateTasks(treeProvider.getAllTasks());
            }
        }),
        vscode.commands.registerCommand('commandtree.refreshQuick', () => {
            quickTasksProvider.refresh();
        })
    );
}

async function handleFilterByTag(): Promise<void> {
    const tags = treeProvider.getAllTags();
    if (tags.length === 0) {
        await vscode.window.showInformationMessage('No tags defined. Right-click commands to add tags.');
        return;
    }
    const items = [
        { label: '$(close) Clear tag filter', tag: null },
        ...tags.map(t => ({ label: `$(tag) ${t}`, tag: t }))
    ];
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select tag to filter by'
    });
    if (selected) {
        treeProvider.setTagFilter(selected.tag);
        updateFilterContext();
    }
}

async function handleAddTag(item: CommandTreeItem | TaskItem | undefined, tagNameArg?: string): Promise<void> {
    const task = item instanceof CommandTreeItem ? item.task : item;
    if (task === undefined || task === null) { return; }
    const tagName = tagNameArg ?? await pickOrCreateTag(treeProvider.getAllTags(), task.label);
    if (tagName === undefined || tagName === '') { return; }
    await treeProvider.addTaskToTag(task, tagName);
    quickTasksProvider.updateTasks(treeProvider.getAllTasks());
}

async function handleRemoveTag(item: CommandTreeItem | TaskItem | undefined, tagNameArg?: string): Promise<void> {
    const task = item instanceof CommandTreeItem ? item.task : item;
    if (task === undefined || task === null) { return; }
    if (task.tags.length === 0 && tagNameArg === undefined) {
        vscode.window.showInformationMessage('This command has no tags');
        return;
    }
    let tagToRemove = tagNameArg;
    if (tagToRemove === undefined) {
        const options = task.tags.map(t => ({ label: `$(tag) ${t}`, tag: t }));
        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: `Remove tag from "${task.label}"`
        });
        if (selected === undefined) { return; }
        tagToRemove = selected.tag;
    }
    await treeProvider.removeTaskFromTag(task, tagToRemove);
    quickTasksProvider.updateTasks(treeProvider.getAllTasks());
}

function setupFileWatcher(context: vscode.ExtensionContext, workspaceRoot: string): void {
    const watcher = vscode.workspace.createFileSystemWatcher(
        '**/{package.json,Makefile,makefile,tasks.json,launch.json,*.sh,*.py}'
    );
    let debounceTimer: NodeJS.Timeout | undefined;
    const onFileChange = (): void => {
        if (debounceTimer !== undefined) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            syncQuickTasks().catch((e: unknown) => {
                logger.error('Sync failed', { error: e instanceof Error ? e.message : 'Unknown' });
            });
        }, 2000);
    };
    watcher.onDidChange(onFileChange);
    watcher.onDidCreate(onFileChange);
    watcher.onDidDelete(onFileChange);
    context.subscriptions.push(watcher);

    const configWatcher = vscode.workspace.createFileSystemWatcher('**/.vscode/commandtree.json');
    let configDebounceTimer: NodeJS.Timeout | undefined;
    const onConfigChange = (): void => {
        if (configDebounceTimer !== undefined) {
            clearTimeout(configDebounceTimer);
        }
        configDebounceTimer = setTimeout(() => {
            syncTagsFromJson(workspaceRoot).catch((e: unknown) => {
                logger.error('Config sync failed', { error: e instanceof Error ? e.message : 'Unknown' });
            });
        }, 1000);
    };
    configWatcher.onDidChange(onConfigChange);
    configWatcher.onDidCreate(onConfigChange);
    configWatcher.onDidDelete(onConfigChange);
    context.subscriptions.push(configWatcher);
}

async function syncQuickTasks(): Promise<void> {
    logger.info('syncQuickTasks START');
    await treeProvider.refresh();
    const allTasks = treeProvider.getAllTasks();
    logger.info('syncQuickTasks after refresh', {
        taskCount: allTasks.length,
        taskIds: allTasks.map(t => t.id)
    });
    quickTasksProvider.updateTasks(allTasks);
    logger.info('syncQuickTasks END');
}

interface TagPattern {
    readonly id?: string;
    readonly type?: string;
    readonly label?: string;
}

function matchesPattern(task: TaskItem, pattern: string | TagPattern): boolean {
    if (typeof pattern === 'string') {
        return task.id === pattern;
    }
    if (pattern.type !== undefined && task.type !== pattern.type) {
        return false;
    }
    if (pattern.label !== undefined && task.label !== pattern.label) {
        return false;
    }
    if (pattern.id !== undefined && task.id !== pattern.id) {
        return false;
    }
    return true;
}

async function syncTagsFromJson(workspaceRoot: string): Promise<void> {
    logger.info('syncTagsFromJson START', { workspaceRoot });
    const configPath = path.join(workspaceRoot, '.vscode', 'commandtree.json');
    if (!fs.existsSync(configPath)) {
        logger.info('No commandtree.json found, skipping tag sync', { configPath });
        return;
    }
    const dbResult = getDb();
    if (!dbResult.ok) {
        logger.warn('DB not available, skipping tag sync', { error: dbResult.error });
        return;
    }
    try {
        const content = fs.readFileSync(configPath, 'utf8');
        logger.info('Read commandtree.json', { contentLength: content.length });
        const config = JSON.parse(content) as { tags?: Record<string, Array<string | TagPattern>> };
        if (config.tags === undefined) {
            logger.info('No tags in config, skipping');
            return;
        }
        const allTasks = treeProvider.getAllTasks();
        logger.info('Got all tasks for pattern matching', { taskCount: allTasks.length });
        for (const [tagName, patterns] of Object.entries(config.tags)) {
            logger.info('Processing tag', { tagName, patternCount: patterns.length });
            const existingIds = getCommandIdsByTag({ handle: dbResult.value, tagName });
            const currentIds = existingIds.ok ? new Set(existingIds.value) : new Set<string>();
            const matchedIds = new Set<string>();
            for (const pattern of patterns) {
                logger.info('Processing pattern', { tagName, pattern });
                for (const task of allTasks) {
                    if (matchesPattern(task, pattern)) {
                        logger.info('Pattern matched task', { tagName, pattern, taskId: task.id, taskLabel: task.label });
                        matchedIds.add(task.id);
                    }
                }
            }
            logger.info('Pattern matching complete', { tagName, matchedCount: matchedIds.size, currentCount: currentIds.size });
            for (const id of currentIds) {
                if (!matchedIds.has(id)) {
                    logger.info('Removing tag from command', { tagName, commandId: id });
                    removeTagFromCommand({ handle: dbResult.value, commandId: id, tagName });
                }
            }
            for (const id of matchedIds) {
                if (!currentIds.has(id)) {
                    logger.info('Adding tag to command', { tagName, commandId: id });
                    addTagToCommand({ handle: dbResult.value, commandId: id, tagName });
                }
            }
        }
        await treeProvider.refresh();
        quickTasksProvider.updateTasks(treeProvider.getAllTasks());
        logger.info('Tag sync completed successfully');
    } catch (e) {
        logger.error('Tag sync failed', { error: e instanceof Error ? e.message : 'Unknown', stack: e instanceof Error ? e.stack : undefined });
    }
}

async function pickOrCreateTag(existingTags: string[], taskLabel: string): Promise<string | undefined> {
    return await new Promise<string | undefined>((resolve) => {
        const qp = vscode.window.createQuickPick();
        qp.placeholder = `Type new tag or select existing — "${taskLabel}"`;
        qp.items = existingTags.map(t => ({ label: t }));
        let resolved = false;
        const finish = (value: string | undefined): void => {
            if (resolved) { return; }
            resolved = true;
            resolve(value);
            qp.dispose();
        };
        qp.onDidAccept(() => {
            const selected = qp.selectedItems[0];
            const value = selected?.label ?? qp.value.trim();
            finish(value !== '' ? value : undefined);
        });
        qp.onDidHide(() => { finish(undefined); });
        qp.show();
    });
}

function updateFilterContext(): void {
    vscode.commands.executeCommand(
        'setContext',
        'commandtree.hasFilter',
        treeProvider.hasFilter()
    );
}

export function deactivate(): void {
    disposeDb();
}
