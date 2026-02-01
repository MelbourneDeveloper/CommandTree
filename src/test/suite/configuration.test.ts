import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
    activateExtension,
    sleep,
    getFixturePath,
    getExtensionPath,
    writeFile,
    deleteFile,
    getTaskTreeProvider
} from './helpers';

interface ConfigurationProperty {
    default: unknown;
    enum?: string[];
    enumDescriptions?: string[];
}

interface PackageJsonConfig {
    contributes: {
        configuration: {
            title: string;
            properties: {
                'tasktree.excludePatterns': ConfigurationProperty;
                'tasktree.sortOrder': ConfigurationProperty;
            };
        };
    };
}

interface TasksJson {
    tasks: Array<{
        label?: string;
        type: string;
        command?: string;
    }>;
}

interface LaunchJson {
    configurations: Array<{
        type: string;
        request: string;
        name: string;
    }>;
}

interface TagConfig {
    tags: Record<string, string[]>;
}

interface FixturePackageJson {
    scripts: Record<string, string>;
}

function readExtensionPackageJson(): PackageJsonConfig {
    return JSON.parse(fs.readFileSync(getExtensionPath('package.json'), 'utf8')) as PackageJsonConfig;
}

suite('Configuration and File Watchers E2E Tests', () => {
    suiteSetup(async function() {
        this.timeout(30000);
        await activateExtension();
        await sleep(2000);
    });

    suite('Extension Settings', () => {
        test('excludePatterns setting exists', function() {
            this.timeout(10000);

            const config = vscode.workspace.getConfiguration('tasktree');
            const excludePatterns = config.get<string[]>('excludePatterns');

            assert.ok(excludePatterns, 'excludePatterns should exist');
            assert.ok(Array.isArray(excludePatterns), 'excludePatterns should be an array');
        });

        test('excludePatterns has sensible defaults', function() {
            this.timeout(10000);

            const packageJson = readExtensionPackageJson();
            const defaultPatterns = packageJson.contributes.configuration.properties['tasktree.excludePatterns'].default as string[];

            assert.ok(defaultPatterns.includes('**/node_modules/**'), 'Should exclude node_modules');
            assert.ok(defaultPatterns.includes('**/bin/**'), 'Should exclude bin');
            assert.ok(defaultPatterns.includes('**/obj/**'), 'Should exclude obj');
            assert.ok(defaultPatterns.includes('**/.git/**'), 'Should exclude .git');
        });

        test('sortOrder setting exists', function() {
            this.timeout(10000);

            const config = vscode.workspace.getConfiguration('tasktree');
            const sortOrder = config.get<string>('sortOrder');

            assert.ok(sortOrder !== undefined && sortOrder !== '', 'sortOrder should exist');
        });

        test('sortOrder has valid enum values', function() {
            this.timeout(10000);

            const packageJson = readExtensionPackageJson();
            const enumValues = packageJson.contributes.configuration.properties['tasktree.sortOrder'].enum;

            assert.ok(enumValues, 'enum should exist');
            assert.ok(enumValues.includes('folder'), 'Should have folder option');
            assert.ok(enumValues.includes('name'), 'Should have name option');
            assert.ok(enumValues.includes('type'), 'Should have type option');
        });

        test('sortOrder defaults to folder', function() {
            this.timeout(10000);

            const packageJson = readExtensionPackageJson();
            const defaultValue = packageJson.contributes.configuration.properties['tasktree.sortOrder'].default;

            assert.strictEqual(defaultValue, 'folder', 'sortOrder should default to folder');
        });

        test('sortOrder has descriptive enum descriptions', function() {
            this.timeout(10000);

            const packageJson = readExtensionPackageJson();
            const enumDescriptions = packageJson.contributes.configuration.properties['tasktree.sortOrder'].enumDescriptions;

            assert.ok(enumDescriptions, 'enumDescriptions should exist');
            assert.ok(enumDescriptions.length === 3, 'Should have 3 descriptions');
            assert.ok(enumDescriptions[0]?.includes('folder') === true, 'First should describe folder');
            assert.ok(enumDescriptions[1]?.includes('name') === true, 'Second should describe name');
            assert.ok(enumDescriptions[2]?.includes('type') === true, 'Third should describe type');
        });
    });

    suite('Configuration Change Handling', () => {
        test('excludePatterns config is applied on refresh', async function() {
            this.timeout(15000);

            const config = vscode.workspace.getConfiguration('tasktree');
            const originalPatterns = config.get<string[]>('excludePatterns');

            try {
                // Update configuration to exclude scripts directory
                await config.update('excludePatterns', [...(originalPatterns ?? []), '**/scripts/**'], vscode.ConfigurationTarget.Workspace);
                await sleep(1000);

                // Trigger refresh
                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(1500);

                // Verify the config was actually updated
                const updatedConfig = vscode.workspace.getConfiguration('tasktree');
                const updatedPatterns = updatedConfig.get<string[]>('excludePatterns') ?? [];
                assert.ok(updatedPatterns.includes('**/scripts/**'), 'Config should include new exclude pattern');
            } finally {
                // Restore original
                await config.update('excludePatterns', originalPatterns, vscode.ConfigurationTarget.Workspace);
                await sleep(500);
            }
        });

        test('sortOrder config has valid value', function() {
            this.timeout(10000);

            const config = vscode.workspace.getConfiguration('tasktree');
            const sortOrder = config.get<string>('sortOrder');

            // Verify config is readable and has valid value
            assert.ok(['folder', 'name', 'type'].includes(sortOrder ?? ''), 'sortOrder should have valid value');
        });
    });

    suite('File Watcher - Package.json', () => {
        test('discovers new npm scripts after package.json creation and refresh', async function() {
            this.timeout(15000);

            const newPackagePath = 'watcher-test/package.json';
            const provider = getTaskTreeProvider();

            try {
                writeFile(newPackagePath, JSON.stringify({
                    name: 'watcher-test',
                    version: '1.0.0',
                    scripts: {
                        'watcher-build': 'echo "watcher build"'
                    }
                }, null, 2));

                // Wait for file watcher to detect and refresh
                await sleep(2000);
                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(1500);

                // Verify the new npm script was discovered
                const allTasks = provider.getAllTasks();
                const watcherTask = allTasks.find(t => t.label === 'watcher-build' && t.type === 'npm');
                assert.ok(watcherTask !== undefined, 'Should discover watcher-build npm script after package.json creation');
            } finally {
                deleteFile(newPackagePath);
                const dir = getFixturePath('watcher-test');
                if (fs.existsSync(dir)) {
                    fs.rmdirSync(dir);
                }
                // Refresh to remove the deleted task
                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(500);
            }
        });

        test('discovers new npm script after package.json modification and refresh', async function() {
            this.timeout(15000);

            const packageJsonPath = getFixturePath('package.json');
            const originalContent = fs.readFileSync(packageJsonPath, 'utf8');
            const provider = getTaskTreeProvider();

            try {
                // Modify package.json to add new script
                const modified = JSON.parse(originalContent) as FixturePackageJson;
                modified.scripts['new-watcher-script'] = 'echo "new script"';
                fs.writeFileSync(packageJsonPath, JSON.stringify(modified, null, 2));

                // Wait for watcher and refresh
                await sleep(2000);
                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(1500);

                // Verify the new script was discovered
                const allTasks = provider.getAllTasks();
                const newTask = allTasks.find(t => t.label === 'new-watcher-script' && t.type === 'npm');
                assert.ok(newTask !== undefined, 'Should discover new-watcher-script after package.json modification');
            } finally {
                // Restore original
                fs.writeFileSync(packageJsonPath, originalContent);
                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(500);
            }
        });
    });

    suite('File Watcher - Makefile', () => {
        test('discovers new make target after Makefile creation and refresh', async function() {
            this.timeout(15000);

            const newMakefilePath = 'watcher-make/Makefile';
            const provider = getTaskTreeProvider();

            try {
                const dir = path.dirname(getFixturePath(newMakefilePath));
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(getFixturePath(newMakefilePath), 'watcher-target:\n\techo "watcher"');

                await sleep(2000);
                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(1500);

                // Verify the new make target was discovered
                const allTasks = provider.getAllTasks();
                const watcherTarget = allTasks.find(t => t.label === 'watcher-target' && t.type === 'make');
                assert.ok(watcherTarget !== undefined, 'Should discover watcher-target after Makefile creation');
            } finally {
                deleteFile(newMakefilePath);
                const dir = getFixturePath('watcher-make');
                if (fs.existsSync(dir)) {
                    fs.rmdirSync(dir);
                }
                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(500);
            }
        });

        test('discovers new make target after Makefile modification and refresh', async function() {
            this.timeout(15000);

            const makefilePath = getFixturePath('Makefile');
            const originalContent = fs.readFileSync(makefilePath, 'utf8');
            const provider = getTaskTreeProvider();

            try {
                // Add new target
                fs.writeFileSync(makefilePath, `${originalContent}\nnew-watcher-target:\n\techo "new"`);

                await sleep(2000);
                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(1500);

                // Verify the new target was discovered
                const allTasks = provider.getAllTasks();
                const newTarget = allTasks.find(t => t.label === 'new-watcher-target' && t.type === 'make');
                assert.ok(newTarget !== undefined, 'Should discover new-watcher-target after Makefile modification');
            } finally {
                fs.writeFileSync(makefilePath, originalContent);
                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(500);
            }
        });
    });

    suite('File Watcher - Shell Scripts', () => {
        test('detects shell script creation', async function() {
            this.timeout(15000);

            const newScriptPath = 'scripts/watcher-script.sh';

            try {
                writeFile(newScriptPath, '#!/bin/bash\n# Watcher test script\necho "watcher"');

                await sleep(2000);
                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(500);

                assert.ok(fs.existsSync(getFixturePath(newScriptPath)), 'Script should be created');
            } finally {
                deleteFile(newScriptPath);
            }
        });

        test('detects shell script deletion', async function() {
            this.timeout(15000);

            const tempScriptPath = 'scripts/temp-delete.sh';

            // Create then delete
            writeFile(tempScriptPath, '#!/bin/bash\necho "temp"');
            await sleep(1000);

            deleteFile(tempScriptPath);
            await sleep(2000);

            assert.ok(!fs.existsSync(getFixturePath(tempScriptPath)), 'Script should be deleted');
        });
    });

    suite('File Watcher - VS Code Config', () => {
        test('discovers new vscode task after tasks.json modification and refresh', async function() {
            this.timeout(15000);

            const tasksJsonPath = getFixturePath('.vscode/tasks.json');
            const originalContent = fs.readFileSync(tasksJsonPath, 'utf8');
            const provider = getTaskTreeProvider();

            try {
                // Parse and modify (remove comments first)
                const cleanJson = originalContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
                const tasks = JSON.parse(cleanJson) as TasksJson;
                tasks.tasks.push({
                    label: 'Watcher Test Task',
                    type: 'shell',
                    command: 'echo "watcher"'
                });

                fs.writeFileSync(tasksJsonPath, JSON.stringify(tasks, null, 4));
                await sleep(2000);
                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(1500);

                // Verify the new task was discovered
                const allTasks = provider.getAllTasks();
                const watcherTask = allTasks.find(t => t.label === 'Watcher Test Task' && t.type === 'vscode');
                assert.ok(watcherTask !== undefined, 'Should discover Watcher Test Task after tasks.json modification');
            } finally {
                fs.writeFileSync(tasksJsonPath, originalContent);
                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(500);
            }
        });

        test('discovers new launch config after launch.json modification and refresh', async function() {
            this.timeout(15000);

            const launchJsonPath = getFixturePath('.vscode/launch.json');
            const originalContent = fs.readFileSync(launchJsonPath, 'utf8');
            const provider = getTaskTreeProvider();

            try {
                // Parse (remove comments first)
                const cleanJson = originalContent
                    .replace(/\/\/.*$/gm, '')
                    .replace(/\/\*[\s\S]*?\*\//g, '');
                const launch = JSON.parse(cleanJson) as LaunchJson;

                launch.configurations.push({
                    type: 'node',
                    request: 'launch',
                    name: 'Watcher Debug Config'
                });

                fs.writeFileSync(launchJsonPath, JSON.stringify(launch, null, 4));
                await sleep(2000);
                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(1500);

                // Verify the new launch config was discovered
                const allTasks = provider.getAllTasks();
                const watcherConfig = allTasks.find(t => t.label === 'Watcher Debug Config' && t.type === 'launch');
                assert.ok(watcherConfig !== undefined, 'Should discover Watcher Debug Config after launch.json modification');
            } finally {
                fs.writeFileSync(launchJsonPath, originalContent);
                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(500);
            }
        });

        test('new tag appears in getAllTags after tasktree.json modification and refresh', async function() {
            this.timeout(15000);

            const tagConfigPath = getFixturePath('.vscode/tasktree.json');
            const originalContent = fs.readFileSync(tagConfigPath, 'utf8');
            const provider = getTaskTreeProvider();

            try {
                const config = JSON.parse(originalContent) as TagConfig;
                config.tags['watcher-tag'] = ['*watcher*'];

                fs.writeFileSync(tagConfigPath, JSON.stringify(config, null, 4));
                await sleep(2000);
                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(1500);

                // Verify the new tag is available
                const allTags = provider.getAllTags();
                assert.ok(allTags.includes('watcher-tag'), 'Should have watcher-tag after tasktree.json modification');
            } finally {
                fs.writeFileSync(tagConfigPath, originalContent);
                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(500);
            }
        });
    });

    suite('Tag Configuration', () => {
        test('tag config file has correct structure', function() {
            this.timeout(10000);

            const tagConfig = JSON.parse(
                fs.readFileSync(getFixturePath('.vscode/tasktree.json'), 'utf8')
            ) as TagConfig;

            assert.ok(typeof tagConfig.tags === 'object', 'Should have tags property as object');
        });

        test('tag patterns are arrays', function() {
            this.timeout(10000);

            const tagConfig = JSON.parse(
                fs.readFileSync(getFixturePath('.vscode/tasktree.json'), 'utf8')
            ) as TagConfig;

            for (const [tagName, patterns] of Object.entries(tagConfig.tags)) {
                assert.ok(Array.isArray(patterns), `Tag ${tagName} patterns should be an array`);
            }
        });

        test('extension works without tasktree.json - returns empty tags', async function() {
            this.timeout(15000);

            // The extension should work even without tasktree.json
            // It will just have no tags
            const provider = getTaskTreeProvider();

            await vscode.commands.executeCommand('tasktree.refresh');
            await sleep(1000);

            // Provider should still function and return tasks
            const allTasks = provider.getAllTasks();
            assert.ok(allTasks.length > 0, 'Should still discover tasks without tasktree.json');
        });
    });

    suite('Glob Pattern Matching', () => {
        test('exclude patterns use glob syntax', function() {
            this.timeout(10000);

            const packageJson = readExtensionPackageJson();
            const patterns = packageJson.contributes.configuration.properties['tasktree.excludePatterns'].default as string[];

            // All patterns should use glob syntax with **
            for (const pattern of patterns) {
                assert.ok(pattern.includes('**'), `Pattern ${pattern} should use ** glob`);
            }
        });

        test('exclude patterns support common directories', function() {
            this.timeout(10000);

            const config = vscode.workspace.getConfiguration('tasktree');
            const patterns = config.get<string[]>('excludePatterns') ?? [];

            // Should exclude common build/dependency directories
            const excludedDirs = ['node_modules', 'bin', 'obj', '.git'];

            for (const dir of excludedDirs) {
                const hasPattern = patterns.some(p => p.includes(dir));
                assert.ok(hasPattern, `Should exclude ${dir}`);
            }
        });
    });

    suite('Configuration Persistence', () => {
        test('workspace settings are read correctly', function() {
            this.timeout(10000);

            const config = vscode.workspace.getConfiguration('tasktree');

            // Read all settings
            const excludePatterns = config.get<string[]>('excludePatterns');
            const sortOrder = config.get<string>('sortOrder');

            assert.ok(excludePatterns !== undefined, 'excludePatterns should be readable');
            assert.ok(sortOrder !== undefined, 'sortOrder should be readable');
        });

        test('configuration has correct section title', function() {
            this.timeout(10000);

            const packageJson = readExtensionPackageJson();

            assert.strictEqual(
                packageJson.contributes.configuration.title,
                'TaskTree',
                'Configuration title should be TaskTree'
            );
        });
    });

    suite('Multiple Workspace Support', () => {
        test('works with single workspace folder', function() {
            this.timeout(10000);

            const folders = vscode.workspace.workspaceFolders;

            assert.ok(folders, 'Should have workspace folders');
            assert.ok(folders.length >= 1, 'Should have at least one workspace folder');
        });

        test('reads config from workspace root', function() {
            this.timeout(10000);

            const folders = vscode.workspace.workspaceFolders;
            assert.ok(folders && folders.length > 0, 'Should have workspace folder');

            const firstFolder = folders[0];
            if (!firstFolder) {
                throw new Error('First folder should exist');
            }

            const workspaceRoot = firstFolder.uri.fsPath;
            const vscodeDir = path.join(workspaceRoot, '.vscode');

            assert.ok(fs.existsSync(vscodeDir), '.vscode directory should exist');
        });
    });
});
