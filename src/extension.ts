import * as vscode from 'vscode';
import { TaskTreeProvider } from './TaskTreeProvider';
import { TaskTreeItem } from './models/TaskItem';
import { TaskRunner } from './runners/TaskRunner';

let treeProvider: TaskTreeProvider;
let taskRunner: TaskRunner;

export interface ExtensionExports {
    taskTreeProvider: TaskTreeProvider;
}

export async function activate(context: vscode.ExtensionContext): Promise<ExtensionExports | undefined> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        return;
    }

    // Initialize providers
    treeProvider = new TaskTreeProvider(workspaceRoot);
    taskRunner = new TaskRunner();

    // Register tree view
    const treeView = vscode.window.createTreeView('tasktree', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('tasktree.refresh', async () => {
            await treeProvider.refresh();
            vscode.window.showInformationMessage('TaskTree refreshed');
        }),

        vscode.commands.registerCommand('tasktree.run', async (item: TaskTreeItem) => {
            if (item?.task) {
                await taskRunner.run(item.task, 'task');
            }
        }),

        vscode.commands.registerCommand('tasktree.runInNewTerminal', async (item: TaskTreeItem) => {
            if (item?.task) {
                await taskRunner.run(item.task, 'newTerminal');
            }
        }),

        vscode.commands.registerCommand('tasktree.runInCurrentTerminal', async (item: TaskTreeItem) => {
            if (item?.task) {
                await taskRunner.run(item.task, 'currentTerminal');
            }
        }),

        vscode.commands.registerCommand('tasktree.debug', async (item: TaskTreeItem) => {
            if (item?.task) {
                await taskRunner.run(item.task, 'debug');
            }
        }),

        vscode.commands.registerCommand('tasktree.filter', async () => {
            const filter = await vscode.window.showInputBox({
                prompt: 'Filter tasks by name, path, or description',
                placeHolder: 'Type to filter...',
                value: ''
            });

            if (filter !== undefined) {
                treeProvider.setTextFilter(filter);
                updateFilterContext();
            }
        }),

        vscode.commands.registerCommand('tasktree.filterByTag', async () => {
            const tags = treeProvider.getAllTags();
            if (tags.length === 0) {
                const action = await vscode.window.showInformationMessage(
                    'No tags defined. Create tag configuration?',
                    'Create'
                );
                if (action === 'Create') {
                    await treeProvider.editTags();
                }
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
        }),

        vscode.commands.registerCommand('tasktree.clearFilter', () => {
            treeProvider.clearFilters();
            updateFilterContext();
        }),

        vscode.commands.registerCommand('tasktree.editTags', async () => {
            await treeProvider.editTags();
        })
    );

    // Watch for file changes that might affect tasks
    const watcher = vscode.workspace.createFileSystemWatcher(
        '**/{package.json,Makefile,makefile,tasks.json,launch.json,tasktree.json,*.sh}'
    );

    watcher.onDidChange(() => treeProvider.refresh());
    watcher.onDidCreate(() => treeProvider.refresh());
    watcher.onDidDelete(() => treeProvider.refresh());
    context.subscriptions.push(watcher);

    // Initial load
    await treeProvider.refresh();

    // Export for testing
    return {
        taskTreeProvider: treeProvider
    };
}

function updateFilterContext(): void {
    vscode.commands.executeCommand(
        'setContext',
        'tasktree.hasFilter',
        treeProvider.hasFilter()
    );
}

export function deactivate(): void {
    // Cleanup handled by disposables
}
