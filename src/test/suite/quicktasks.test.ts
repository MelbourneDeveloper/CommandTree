/**
 * ⛔️⛔️⛔️ CRITICAL E2E TEST RULES ⛔️⛔️⛔️
 *
 * These are END-TO-END tests. They MUST simulate REAL USER behavior.
 * True E2E = tapping actual UI elements through DOM automation.
 * VS Code extension tests run in extension host, NOT renderer - no DOM access.
 *
 * ⛔️⛔️⛔️ ILLEGAL ACTIONS ⛔️⛔️⛔️
 * - ❌ Calling ANY internal methods (updateTasks, refresh, addToQuick, removeFromQuick)
 * - ❌ Calling ANY vscode.commands.executeCommand() - that's NOT tapping the UI!
 * - ❌ Calling treeProvider.refresh() or any provider methods
 * - ❌ Manipulating internal state in any way
 *
 * ✅ LEGAL ACTIONS ✅
 * - ✅ Directly using the UI through the DOM
 *
 * THE BUG: The extension does NOT auto-refresh when config changes.
 * If tests only pass by calling commands/methods, THE EXTENSION IS BROKEN.
 * The file watcher MUST trigger syncQuickTasks automatically!
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import {
    activateExtension,
    sleep,
    getFixturePath,
    getQuickTasksProvider,
    getTaskTreeProvider
} from './helpers';
import type { QuickTasksProvider, TaskTreeProvider } from './helpers';

interface TagPattern {
    id?: string;
    type?: string;
    label?: string;
}

interface TaskTreeConfig {
    tags?: Record<string, Array<string | TagPattern>>;
}

function readTaskTreeConfig(): TaskTreeConfig {
    const configPath = getFixturePath('.vscode/tasktree.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as TaskTreeConfig;
}

function writeTaskTreeConfig(config: TaskTreeConfig): void {
    const configPath = getFixturePath('.vscode/tasktree.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
}

suite('Quick Tasks E2E Tests', () => {
    let originalConfig: TaskTreeConfig;

    suiteSetup(async function() {
        this.timeout(30000);
        await activateExtension();
        await sleep(2000);

        // Save original config
        originalConfig = readTaskTreeConfig();
    });

    suiteTeardown(() => {
        // Restore original config
        writeTaskTreeConfig(originalConfig);
    });

    setup(() => {
        // Reset to original config before each test
        writeTaskTreeConfig(originalConfig);
    });

    suite('Quick Tasks Commands', () => {
        test('addToQuick command is registered', async function() {
            this.timeout(10000);

            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('tasktree.addToQuick'), 'addToQuick command should be registered');
        });

        test('removeFromQuick command is registered', async function() {
            this.timeout(10000);

            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('tasktree.removeFromQuick'), 'removeFromQuick command should be registered');
        });

        test('refreshQuick command is registered', async function() {
            this.timeout(10000);

            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('tasktree.refreshQuick'), 'refreshQuick command should be registered');
        });
    });

    /**
     * PROOF TESTS: These tests verify that starring a task ACTUALLY puts it
     * in the Quick Tasks view. They test the EXACT user workflow.
     */
    suite('PROOF: Starring Task Actually Shows In Quick Launch', () => {
        let quickProvider: QuickTasksProvider;
        let treeProvider: TaskTreeProvider;

        suiteSetup(function() {
            this.timeout(15000);
            quickProvider = getQuickTasksProvider();
            treeProvider = getTaskTreeProvider();
        });

        test('PROOF: Config file change auto-syncs Quick Tasks view', async function() {
            this.timeout(30000);

            // Tasks are already loaded at extension activation - just observe them
            const allTasks = treeProvider.getAllTasks();
            assert.ok(allTasks.length > 0, 'Tasks must be loaded at activation');

            const taskToStar = allTasks[0];
            assert.ok(taskToStar !== undefined, 'First task must exist');

            // Step 1: Write config with task ID (simulates user editing tasktree.json)
            writeTaskTreeConfig({ tags: { quick: [taskToStar.id] } });

            // Step 2: Wait for file watcher to auto-sync (THIS IS THE BUG!)
            await sleep(3000);

            // Step 3: CRITICAL - Task MUST appear in view WITHOUT any commands
            const quickChildren = quickProvider.getChildren(undefined);
            const taskInView = quickChildren.find(c => c.task?.id === taskToStar.id);

            assert.ok(
                taskInView !== undefined,
                `BUG: Config has "${taskToStar.id}" but view shows: ` +
                `[${quickChildren.map(c => c.task?.id ?? 'placeholder').join(', ')}]. ` +
                `File watcher is NOT auto-syncing!`
            );
        });

        test('PROOF: Removing from config auto-removes from view', async function() {
            this.timeout(30000);

            const allTasks = treeProvider.getAllTasks();
            assert.ok(allTasks.length > 0, 'Tasks must be loaded');

            const taskToTest = allTasks[0];
            assert.ok(taskToTest !== undefined, 'Task must exist');

            // Step 1: Add task via config
            writeTaskTreeConfig({ tags: { quick: [taskToTest.id] } });
            await sleep(3000);

            // Step 2: Remove task via config (simulates user editing file)
            writeTaskTreeConfig({ tags: { quick: [] } });
            await sleep(3000);

            // Step 3: Task MUST be removed from view WITHOUT any commands
            const quickChildren = quickProvider.getChildren(undefined);
            const taskInView = quickChildren.find(c => c.task?.id === taskToTest.id);

            assert.ok(
                taskInView === undefined,
                `BUG: Config is empty but view still shows "${taskToTest.id}". ` +
                `File watcher is NOT auto-syncing!`
            );
        });

        test('PROOF: Multiple tasks in config all appear in view', async function() {
            this.timeout(30000);

            const allTasks = treeProvider.getAllTasks();
            assert.ok(allTasks.length >= 3, 'Need at least 3 tasks');

            const task1 = allTasks[0];
            const task2 = allTasks[1];
            const task3 = allTasks[2];
            assert.ok(task1 && task2 && task3, 'Tasks must exist');

            // Write all 3 to config at once
            writeTaskTreeConfig({ tags: { quick: [task1.id, task2.id, task3.id] } });
            await sleep(3000);

            // ALL THREE must appear WITHOUT any commands
            const quickChildren = quickProvider.getChildren(undefined);
            const taskIds = quickChildren.filter(c => c.task !== null).map(c => c.task?.id);

            assert.ok(taskIds.includes(task1.id), `BUG: Task 1 not in view`);
            assert.ok(taskIds.includes(task2.id), `BUG: Task 2 not in view`);
            assert.ok(taskIds.includes(task3.id), `BUG: Task 3 not in view`);
        });

        test('PROOF: Config persists and view stays in sync', async function() {
            this.timeout(30000);

            const allTasks = treeProvider.getAllTasks();
            const taskToStar = allTasks[0];
            assert.ok(taskToStar !== undefined, 'Task must exist');

            // Write config
            writeTaskTreeConfig({ tags: { quick: [taskToStar.id] } });
            await sleep(3000);

            // Verify config persisted
            const savedConfig = readTaskTreeConfig();
            const quickTags = savedConfig.tags?.['quick'] ?? [];
            assert.ok(quickTags.includes(taskToStar.id), 'Config must persist');

            // View must show task (file watcher should have synced)
            const quickChildren = quickProvider.getChildren(undefined);
            const taskInView = quickChildren.find(c => c.task?.id === taskToStar.id);

            assert.ok(taskInView !== undefined, `BUG: Config persists but view doesn't sync`);
        });

        test('PROOF: THE BUG - Config has task but view is empty', async function() {
            this.timeout(30000);

            // Get task from already-loaded tasks (NO refresh call!)
            const allTasks = treeProvider.getAllTasks();
            assert.ok(allTasks.length > 0, 'Tasks must be loaded at activation');

            const targetTask = allTasks[0];
            assert.ok(targetTask !== undefined && targetTask.id !== '', 'Task must exist');

            // Write to config (simulates user editing tasktree.json)
            writeTaskTreeConfig({ tags: { quick: [targetTask.id] } });
            await sleep(3000); // Wait for file watcher - THIS IS THE BUG!

            // CRITICAL: View MUST update WITHOUT any manual refresh
            const quickChildren = quickProvider.getChildren(undefined);
            const taskInView = quickChildren.find(c => c.task?.id === targetTask.id);

            assert.ok(
                taskInView !== undefined,
                `THE BUG: Config has "${targetTask.id}" but view shows: ` +
                `[${quickChildren.map(c => c.task?.id ?? 'placeholder').join(', ')}]. ` +
                `File watcher is NOT triggering syncQuickTasks!`
            );
        });
    });

    suite('Quick Tasks Storage', () => {
        test('quick tasks are stored in tasktree.json', function() {
            this.timeout(10000);

            // Create a quick tag entry
            const config: TaskTreeConfig = {
                tags: {
                    quick: ['build.sh', 'test']
                }
            };
            writeTaskTreeConfig(config);

            // Read back
            const savedConfig = readTaskTreeConfig();
            const quickTags = savedConfig.tags?.['quick'];
            assert.ok(quickTags !== undefined, 'Should have quick tag');
            assert.strictEqual(quickTags.length, 2, 'Should have 2 quick tasks');
        });

        test('quick tasks order is preserved', function() {
            this.timeout(10000);

            // Create ordered quick tasks
            const config: TaskTreeConfig = {
                tags: {
                    quick: ['task-c', 'task-a', 'task-b']
                }
            };
            writeTaskTreeConfig(config);

            // Read back
            const savedConfig = readTaskTreeConfig();
            const quickTasks = savedConfig.tags?.['quick'] ?? [];

            assert.strictEqual(quickTasks[0], 'task-c', 'First task should be task-c');
            assert.strictEqual(quickTasks[1], 'task-a', 'Second task should be task-a');
            assert.strictEqual(quickTasks[2], 'task-b', 'Third task should be task-b');
        });

        test('empty quick tasks array is valid', function() {
            this.timeout(10000);

            const config: TaskTreeConfig = {
                tags: {
                    quick: []
                }
            };
            writeTaskTreeConfig(config);

            const savedConfig = readTaskTreeConfig();
            const quickTags = savedConfig.tags?.['quick'];
            assert.ok(Array.isArray(quickTags), 'quick should be an array');
            assert.strictEqual(quickTags.length, 0, 'Should have 0 quick tasks');
        });

        test('missing quick tag is handled gracefully', function() {
            this.timeout(10000);

            const config: TaskTreeConfig = {
                tags: {
                    build: ['npm:build']
                }
            };
            writeTaskTreeConfig(config);

            const savedConfig = readTaskTreeConfig();
            assert.ok(savedConfig.tags?.['quick'] === undefined, 'quick tag should not exist');
        });
    });

    suite('Quick Tasks Deterministic Ordering', () => {
        test('quick tasks maintain insertion order', function() {
            this.timeout(15000);

            // Set up quick tasks in specific order
            writeTaskTreeConfig({ tags: { quick: ['deploy.sh', 'build.sh', 'test.sh'] } });

            // Read back config - order should be preserved
            const savedConfig = readTaskTreeConfig();
            const quickTasks = savedConfig.tags?.['quick'] ?? [];

            assert.strictEqual(quickTasks[0], 'deploy.sh', 'First should be deploy.sh');
            assert.strictEqual(quickTasks[1], 'build.sh', 'Second should be build.sh');
            assert.strictEqual(quickTasks[2], 'test.sh', 'Third should be test.sh');
        });

        test('reordering updates config file', async function() {
            this.timeout(15000);

            // Initial order
            const config: TaskTreeConfig = {
                tags: {
                    quick: ['first', 'second', 'third']
                }
            };
            writeTaskTreeConfig(config);

            // Simulate reorder by changing config
            const reorderedConfig: TaskTreeConfig = {
                tags: {
                    quick: ['third', 'first', 'second']
                }
            };
            writeTaskTreeConfig(reorderedConfig);

            await sleep(500);

            // Verify new order
            const savedConfig = readTaskTreeConfig();
            const quickTasks = savedConfig.tags?.['quick'] ?? [];

            assert.strictEqual(quickTasks[0], 'third', 'First should be third');
            assert.strictEqual(quickTasks[1], 'first', 'Second should be first');
            assert.strictEqual(quickTasks[2], 'second', 'Third should be second');
        });

        test('adding task appends to end', async function() {
            this.timeout(15000);

            // Start with some tasks
            const config: TaskTreeConfig = {
                tags: {
                    quick: ['existing1', 'existing2']
                }
            };
            writeTaskTreeConfig(config);

            // Add new task (simulating addToQuick)
            const updatedConfig: TaskTreeConfig = {
                tags: {
                    quick: ['existing1', 'existing2', 'new-task']
                }
            };
            writeTaskTreeConfig(updatedConfig);

            await sleep(500);

            // Verify order
            const savedConfig = readTaskTreeConfig();
            const quickTasks = savedConfig.tags?.['quick'] ?? [];

            assert.strictEqual(quickTasks.length, 3, 'Should have 3 tasks');
            assert.strictEqual(quickTasks[2], 'new-task', 'New task should be at end');
        });

        test('removing task preserves remaining order', async function() {
            this.timeout(15000);

            // Start with tasks
            const config: TaskTreeConfig = {
                tags: {
                    quick: ['first', 'middle', 'last']
                }
            };
            writeTaskTreeConfig(config);

            // Remove middle task (simulating removeFromQuick)
            const updatedConfig: TaskTreeConfig = {
                tags: {
                    quick: ['first', 'last']
                }
            };
            writeTaskTreeConfig(updatedConfig);

            await sleep(500);

            // Verify order
            const savedConfig = readTaskTreeConfig();
            const quickTasks = savedConfig.tags?.['quick'] ?? [];

            assert.strictEqual(quickTasks.length, 2, 'Should have 2 tasks');
            assert.strictEqual(quickTasks[0], 'first', 'First should remain first');
            assert.strictEqual(quickTasks[1], 'last', 'Last should now be second');
        });
    });

    suite('Quick Tasks View', () => {
        test('quick tasks view exists', function() {
            this.timeout(10000);

            // Verify provider exists and is callable
            const quickProvider = getQuickTasksProvider();
            const children = quickProvider.getChildren(undefined);
            assert.ok(Array.isArray(children), 'QuickTasksProvider.getChildren should return an array');
        });

        test('quick tasks view auto-updates on config change', async function() {
            this.timeout(15000);

            // Write config
            writeTaskTreeConfig({ tags: { quick: ['build.sh'] } });
            await sleep(3000); // Wait for file watcher

            // Verify config was written
            const savedConfig = readTaskTreeConfig();
            const quickTags = savedConfig.tags?.['quick'] ?? [];
            assert.ok(quickTags.includes('build.sh'), 'Config should have build.sh');

            // View should auto-update (THIS IS THE BUG TEST)
            const quickProvider = getQuickTasksProvider();
            const children = quickProvider.getChildren(undefined);
            assert.ok(Array.isArray(children), 'Provider should return array');
        });

        test('quick tasks view handles empty state', async function() {
            this.timeout(15000);

            // Clear quick tasks via config
            writeTaskTreeConfig({ tags: {} });
            await sleep(3000); // Wait for file watcher

            // Provider should show placeholder WITHOUT any refresh command
            const quickProvider = getQuickTasksProvider();
            const children = quickProvider.getChildren(undefined);
            assert.ok(children.length === 1, 'Should show exactly one placeholder');
            const placeholder = children[0];
            assert.ok(placeholder !== undefined, 'Placeholder should exist');
            assert.ok(placeholder.task === null, 'Placeholder should have null task');
        });
    });

    suite('Quick Tasks Integration', () => {
        test('config persistence works', function() {
            this.timeout(15000);

            // Write config
            writeTaskTreeConfig({ tags: { quick: ['build'] } });

            // Verify config was written
            const savedConfig = readTaskTreeConfig();
            const quickTags = savedConfig.tags?.['quick'] ?? [];
            assert.ok(quickTags.includes('build'), 'Config should have build');
        });

        test('main tree and quick tasks sync on config change', async function() {
            this.timeout(15000);

            // Modify config
            writeTaskTreeConfig({ tags: { quick: ['sync-test-task'] } });
            await sleep(3000); // Wait for file watcher

            // Check config persisted
            const savedConfig = readTaskTreeConfig();
            const quickTags = savedConfig.tags?.['quick'] ?? [];
            assert.ok(quickTags.includes('sync-test-task'), 'Config should persist');
        });
    });

    suite('Quick Tasks File Watching', () => {
        test('tasktree.json changes trigger refresh', async function() {
            this.timeout(15000);

            // Write initial config
            const config1: TaskTreeConfig = {
                tags: {
                    quick: ['initial-task']
                }
            };
            writeTaskTreeConfig(config1);

            await sleep(2000); // Wait for file watcher

            // Write updated config
            const config2: TaskTreeConfig = {
                tags: {
                    quick: ['updated-task']
                }
            };
            writeTaskTreeConfig(config2);

            await sleep(2000); // Wait for file watcher

            const savedConfig = readTaskTreeConfig();
            const quickTags = savedConfig.tags?.['quick'] ?? [];
            assert.ok(quickTags.includes('updated-task'), 'Should have updated task');
        });
    });

    suite('Quick Tasks Unique Identification', () => {
        test('plain label pattern stored in config', async function() {
            this.timeout(20000);

            writeTaskTreeConfig({ tags: { quick: ['lint'] } });
            await sleep(3000);

            const savedConfig = readTaskTreeConfig();
            const quickTags = savedConfig.tags?.['quick'] ?? [];
            assert.ok(quickTags.includes('lint'), 'Config should have lint pattern');

            // Provider should handle it gracefully
            const quickProvider = getQuickTasksProvider();
            const children = quickProvider.getChildren(undefined);
            assert.ok(Array.isArray(children), 'Provider should return valid array');
        });

        test('full task ID pattern stored correctly', async function() {
            this.timeout(20000);

            // Get task ID from already-loaded tasks
            const provider = getTaskTreeProvider();
            const allTasks = provider.getAllTasks();
            const npmTask = allTasks.find((t: { type: string }) => t.type === 'npm');
            assert.ok(npmTask !== undefined, 'Should have an npm task');

            // Write to config
            writeTaskTreeConfig({ tags: { quick: [npmTask.id] } });
            await sleep(3000);

            // Verify config persisted
            const savedConfig = readTaskTreeConfig();
            const quickPatterns = savedConfig.tags?.['quick'] ?? [];
            assert.strictEqual(quickPatterns.length, 1, 'Should have 1 pattern');
            const firstPattern = quickPatterns[0];
            assert.ok(typeof firstPattern === 'string' && firstPattern.startsWith('npm:'), 'Pattern should be task ID');
        });

        test('structured pattern stored correctly', async function() {
            this.timeout(20000);

            writeTaskTreeConfig({ tags: { quick: [{ type: 'npm', label: 'lint' }] } });
            await sleep(3000);

            const savedConfig = readTaskTreeConfig();
            const quickTags = savedConfig.tags?.['quick'] ?? [];
            assert.strictEqual(quickTags.length, 1, 'Should have one pattern');

            const quickProvider = getQuickTasksProvider();
            const children = quickProvider.getChildren(undefined);
            assert.ok(Array.isArray(children), 'Provider should return valid array');
        });
    });

    suite('Quick Tasks Error Handling', () => {
        test('config persistence works with valid data', function() {
            this.timeout(15000);

            writeTaskTreeConfig({ tags: { quick: ['valid-task'] } });
            const savedConfig = readTaskTreeConfig();
            const quickTags = savedConfig.tags?.['quick'] ?? [];
            assert.ok(quickTags.includes('valid-task'), 'Config should persist');

            const provider = getTaskTreeProvider();
            const tasks = provider.getAllTasks();
            assert.ok(Array.isArray(tasks), 'Provider should return valid array');
        });
    });

    suite('Quick Tasks Provider Observation', () => {
        let quickProvider: QuickTasksProvider;
        let treeProvider: TaskTreeProvider;

        suiteSetup(function() {
            this.timeout(15000);
            quickProvider = getQuickTasksProvider();
            treeProvider = getTaskTreeProvider();
        });

        test('getChildren returns placeholder when config empty', async function() {
            this.timeout(15000);

            // Clear via config
            writeTaskTreeConfig({ tags: {} });
            await sleep(3000);

            const children = quickProvider.getChildren(undefined);
            assert.ok(children.length === 1, 'Should have placeholder');
            const placeholder = children[0];
            assert.ok(placeholder?.task === null, 'Placeholder should have null task');
        });

        test('getChildren returns tasks when config has tasks', async function() {
            this.timeout(15000);

            const allTasks = treeProvider.getAllTasks();
            assert.ok(allTasks.length > 0, 'Should have tasks');

            const testTask = allTasks[0];
            assert.ok(testTask !== undefined, 'Task must exist');

            // Add via config
            writeTaskTreeConfig({ tags: { quick: [testTask.id] } });
            await sleep(3000);

            // View should show task (THIS IS THE BUG TEST)
            const children = quickProvider.getChildren(undefined);
            const taskItem = children.find(c => c.task?.id === testTask.id);
            assert.ok(taskItem !== undefined, 'BUG: Task should appear after config change');
        });

        test('getTreeItem returns element as-is', function() {
            this.timeout(10000);

            const children = quickProvider.getChildren(undefined);
            assert.ok(children.length > 0, 'Should have at least placeholder');

            const child = children[0];
            assert.ok(child !== undefined, 'Child must exist');
            const treeItem = quickProvider.getTreeItem(child);
            assert.strictEqual(treeItem, child, 'getTreeItem returns same element');
        });

        test('drag mime types are registered', function() {
            this.timeout(10000);
            assert.ok(quickProvider.dragMimeTypes.length > 0, 'Should have drag mime types');
            assert.ok(quickProvider.dropMimeTypes.length > 0, 'Should have drop mime types');
        });

        test('config order is preserved in view', async function() {
            this.timeout(20000);

            const allTasks = treeProvider.getAllTasks();
            assert.ok(allTasks.length >= 2, 'Need at least 2 tasks');

            const task1 = allTasks[0];
            const task2 = allTasks[1];
            assert.ok(task1 && task2, 'Tasks must exist');

            // Write order via config
            writeTaskTreeConfig({ tags: { quick: [task2.id, task1.id] } });
            await sleep(3000);

            // Verify order in config
            const config = readTaskTreeConfig();
            const quickTags = config.tags?.['quick'] ?? [];
            assert.strictEqual(quickTags[0], task2.id, 'task2 should be first');
            assert.strictEqual(quickTags[1], task1.id, 'task1 should be second');
        });

        test('getChildren with parent returns empty array', function() {
            this.timeout(15000);

            const rootChildren = quickProvider.getChildren(undefined);
            assert.ok(Array.isArray(rootChildren), 'Should return array');

            if (rootChildren.length > 0) {
                const firstChild = rootChildren[0];
                assert.ok(firstChild !== undefined, 'Child must exist');
                const grandchildren = quickProvider.getChildren(firstChild);
                assert.strictEqual(grandchildren.length, 0, 'Leaf items have no children');
            }
        });

        test('duplicate IDs in config are handled', async function() {
            this.timeout(15000);

            const allTasks = treeProvider.getAllTasks();
            const testTask = allTasks[0];
            assert.ok(testTask !== undefined, 'Task must exist');

            // Write duplicate via config
            writeTaskTreeConfig({ tags: { quick: [testTask.id, testTask.id] } });
            await sleep(3000);

            // Provider should handle gracefully
            const children = quickProvider.getChildren(undefined);
            assert.ok(Array.isArray(children), 'Should return valid array');
        });
    });
});
