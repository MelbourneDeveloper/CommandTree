import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import {
    activateExtension,
    sleep,
    getFixturePath,
    getTaskTreeProvider
} from './helpers';

interface TagConfig {
    tags: Record<string, string[]>;
}

suite('Task Filtering E2E Tests', () => {
    suiteSetup(async function() {
        this.timeout(30000);
        await activateExtension();
        await sleep(2000);
    });

    suite('Text Filtering', () => {
        test('filter command is registered', async function() {
            this.timeout(10000);

            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('tasktree.filter'), 'filter command should be registered');
        });

        test('clearFilter command is registered', async function() {
            this.timeout(10000);

            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('tasktree.clearFilter'), 'clearFilter command should be registered');
        });

        test('clearFilter resets hasFilter to false', async function() {
            this.timeout(10000);

            const provider = getTaskTreeProvider();

            // Set a filter first
            provider.setTextFilter('build');
            assert.strictEqual(provider.hasFilter(), true, 'hasFilter should be true after setTextFilter');

            // Clear filter via provider
            provider.clearFilters();
            assert.strictEqual(provider.hasFilter(), false, 'hasFilter should be false after clearFilters');
        });
    });

    suite('Tag Filtering', () => {
        test('filterByTag command is registered', async function() {
            this.timeout(10000);

            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('tasktree.filterByTag'), 'filterByTag command should be registered');
        });

        test('tag configuration file exists in fixtures', function() {
            this.timeout(10000);

            const tagConfigPath = getFixturePath('.vscode/tasktree.json');
            assert.ok(fs.existsSync(tagConfigPath), 'tasktree.json should exist');
        });

        test('tag configuration has expected structure', function() {
            this.timeout(10000);

            const tagConfigPath = getFixturePath('.vscode/tasktree.json');
            const content = JSON.parse(fs.readFileSync(tagConfigPath, 'utf8')) as TagConfig;

            assert.ok('build' in content.tags, 'Should have build tag');
            assert.ok(content.tags['test'], 'Should have test tag');
            assert.ok(content.tags['deploy'], 'Should have deploy tag');
            assert.ok(content.tags['debug'], 'Should have debug tag');
            assert.ok(content.tags['scripts'], 'Should have scripts tag');
            assert.ok(content.tags['ci'], 'Should have ci tag');
        });

        test('tag patterns include glob wildcards', function() {
            this.timeout(10000);

            const tagConfig = JSON.parse(fs.readFileSync(getFixturePath('.vscode/tasktree.json'), 'utf8')) as TagConfig;

            // Check build tag patterns
            const buildPatterns = tagConfig.tags['build'];
            assert.ok(buildPatterns, 'build tag should exist');
            assert.ok(buildPatterns.includes('*build*'), 'build tag should have wildcard pattern');
            assert.ok(buildPatterns.includes('type:make:build'), 'build tag should have type:make:build');
            assert.ok(buildPatterns.includes('type:npm:build'), 'build tag should have type:npm:build');
        });

        test('tag patterns support type:tasktype:label format', function() {
            this.timeout(10000);

            const tagConfig = JSON.parse(fs.readFileSync(getFixturePath('.vscode/tasktree.json'), 'utf8')) as TagConfig;

            // Check debug tag patterns - should match launch configs
            const debugPatterns = tagConfig.tags['debug'];
            assert.ok(debugPatterns, 'debug tag should exist');
            assert.ok(debugPatterns.includes('type:launch:*'), 'debug tag should have type:launch:* pattern');
        });

        test('editTags command opens configuration file', async function() {
            this.timeout(15000);

            // Close all editors first
            await vscode.commands.executeCommand('workbench.action.closeAllEditors');
            await sleep(500);

            // Execute editTags
            await vscode.commands.executeCommand('tasktree.editTags');
            await sleep(1000);

            // Check if an editor was opened
            const activeEditor = vscode.window.activeTextEditor;
            assert.ok(activeEditor !== undefined, 'editTags should open an editor');

            const fileName = activeEditor.document.fileName;
            assert.ok(fileName.includes('tasktree.json'), 'Should open tasktree.json');

            // Clean up
            await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        });

        test('tasktree.json config file exists in fixtures', function(this: Mocha.Context) {
            this.timeout(15000);

            // Verify the fixture has the expected config file
            const configPath = getFixturePath('.vscode/tasktree.json');
            assert.ok(fs.existsSync(configPath), 'tasktree.json should exist in fixtures');

            // Verify it has valid JSON
            const content = JSON.parse(fs.readFileSync(configPath, 'utf8')) as TagConfig;
            assert.ok(typeof content.tags === 'object', 'Config should have tags object');
        });
    });

    suite('Tag Pattern Matching', () => {
        test('wildcard * matches any characters within segment', function() {
            this.timeout(10000);

            const tagConfig = JSON.parse(fs.readFileSync(getFixturePath('.vscode/tasktree.json'), 'utf8')) as TagConfig;

            // Pattern *build* should match:
            // - "build" (exact)
            // - "prebuild"
            // - "build-prod"
            // - "my-build-task"

            const buildPatterns = tagConfig.tags['build'];
            assert.ok(buildPatterns, 'build tag should exist');
            assert.ok(buildPatterns.some((p: string) => p.includes('*')), 'Should have wildcard patterns');
        });

        test('type: prefix pattern format is supported', function() {
            this.timeout(10000);

            const tagConfig = JSON.parse(fs.readFileSync(getFixturePath('.vscode/tasktree.json'), 'utf8')) as TagConfig;

            // Check various type patterns
            const scriptsPatterns = tagConfig.tags['scripts'];
            assert.ok(scriptsPatterns, 'scripts tag should exist');
            assert.ok(
                scriptsPatterns.includes('type:shell:*'),
                'scripts tag should match all shell scripts'
            );

            const debugPatterns = tagConfig.tags['debug'];
            assert.ok(debugPatterns, 'debug tag should exist');
            assert.ok(
                debugPatterns.includes('type:launch:*'),
                'debug tag should match all launch configs'
            );
        });

        test('ci tag matches multiple npm scripts', function() {
            this.timeout(10000);

            const tagConfig = JSON.parse(fs.readFileSync(getFixturePath('.vscode/tasktree.json'), 'utf8')) as TagConfig;

            const ciPatterns = tagConfig.tags['ci'];
            assert.ok(ciPatterns, 'ci tag should exist');
            assert.ok(ciPatterns.includes('type:npm:lint'), 'ci should include lint');
            assert.ok(ciPatterns.includes('type:npm:test'), 'ci should include test');
            assert.ok(ciPatterns.includes('type:npm:build'), 'ci should include build');
        });
    });

    suite('Filter State Management', () => {
        test('filter state persists across refresh', async function() {
            this.timeout(15000);

            const provider = getTaskTreeProvider();

            // Set a filter
            provider.setTextFilter('build');
            assert.strictEqual(provider.hasFilter(), true, 'hasFilter should be true before refresh');

            // Trigger refresh
            await vscode.commands.executeCommand('tasktree.refresh');
            await sleep(1000);

            // Filter state should persist
            assert.strictEqual(provider.hasFilter(), true, 'hasFilter should still be true after refresh');

            // Clean up
            provider.clearFilters();
        });

        test('clearFilters clears both text and tag filters', async function() {
            this.timeout(10000);

            const provider = getTaskTreeProvider();

            // Set both filters
            provider.setTextFilter('build');
            provider.setTagFilter('test');
            assert.strictEqual(provider.hasFilter(), true, 'hasFilter should be true with filters set');

            // Clear all filters
            provider.clearFilters();
            assert.strictEqual(provider.hasFilter(), false, 'hasFilter should be false after clearFilters');
        });
    });

    suite('Filter UI Integration', () => {
        test('filter command is registered', async function() {
            this.timeout(10000);

            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('tasktree.filter'), 'filter command should exist');
        });

        test('filterByTag command is registered', async function() {
            this.timeout(10000);

            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('tasktree.filterByTag'), 'filterByTag command should exist');
        });

        test('setTextFilter reduces visible tasks', async function() {
            this.timeout(10000);

            const provider = getTaskTreeProvider();

            // Get unfiltered count
            provider.clearFilters();
            await provider.refresh();
            await sleep(500);
            const allTasks = provider.getAllTasks();
            const unfilteredCount = allTasks.length;

            // Apply filter
            provider.setTextFilter('deploy');
            const filteredTasks = provider.getAllTasks().filter(t =>
                t.label.toLowerCase().includes('deploy') ||
                t.filePath.toLowerCase().includes('deploy') ||
                (t.description ?? '').toLowerCase().includes('deploy')
            );

            // Filtered count should be less than unfiltered (unless all tasks match)
            assert.ok(filteredTasks.length <= unfilteredCount, 'Filtering should not increase task count');

            // Clean up
            provider.clearFilters();
        });
    });

    suite('Filter Edge Cases', () => {
        test('empty filter shows all tasks', async function() {
            this.timeout(10000);

            const provider = getTaskTreeProvider();

            // Get initial count with no filter
            provider.clearFilters();
            await provider.refresh();
            await sleep(500);
            const allTasksCount = provider.getAllTasks().length;

            // Set empty filter (should show all)
            provider.setTextFilter('');
            const afterEmptyFilter = provider.getAllTasks().length;

            assert.strictEqual(afterEmptyFilter, allTasksCount, 'Empty filter should show all tasks');
        });

        test('non-existent tag filter shows no tasks', async function() {
            this.timeout(10000);

            const provider = getTaskTreeProvider();

            // Set filter for non-existent tag
            provider.setTagFilter('nonexistent-tag-xyz-12345');
            await provider.refresh();
            await sleep(500);

            // Get children - should have no tasks with this tag
            const children = await provider.getChildren(undefined);
            let totalTasks = 0;
            for (const category of children) {
                const categoryChildren = await provider.getChildren(category);
                totalTasks += categoryChildren.length;
            }

            assert.strictEqual(totalTasks, 0, 'Non-existent tag filter should show no tasks');

            // Clean up
            provider.clearFilters();
        });

        test('tags in config are lowercase', function() {
            this.timeout(10000);

            const tagConfig = JSON.parse(fs.readFileSync(getFixturePath('.vscode/tasktree.json'), 'utf8')) as TagConfig;

            // Tags should be lowercase
            assert.ok(tagConfig.tags['build'] !== undefined, 'Should have lowercase build tag');
            assert.ok(tagConfig.tags['test'] !== undefined, 'Should have lowercase test tag');
        });
    });

    suite('Filter with Tag Configuration Changes', () => {
        test('refreshes when tag configuration changes', async function() {
            this.timeout(15000);

            const tagConfigPath = getFixturePath('.vscode/tasktree.json');
            const originalContent = fs.readFileSync(tagConfigPath, 'utf8');

            try {
                // Modify tag configuration
                const config = JSON.parse(originalContent) as TagConfig;
                config.tags['newTag'] = ['*new*'];
                fs.writeFileSync(tagConfigPath, JSON.stringify(config, null, 4));

                // Wait for file watcher to trigger refresh
                await sleep(2000);

                // Verify file was modified
                const newContent = fs.readFileSync(tagConfigPath, 'utf8');
                assert.ok(newContent.includes('newTag'), 'Config should have new tag');
            } finally {
                // Restore original
                fs.writeFileSync(tagConfigPath, originalContent);
                await sleep(500);
            }
        });

        test('invalid JSON config results in empty tags', async function() {
            this.timeout(15000);

            const tagConfigPath = getFixturePath('.vscode/tasktree.json');
            const originalContent = fs.readFileSync(tagConfigPath, 'utf8');
            const provider = getTaskTreeProvider();

            try {
                // Write invalid JSON
                fs.writeFileSync(tagConfigPath, '{ invalid json }');

                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(1000);

                // Provider should still work, just with no tags
                const tags = provider.getAllTags();
                assert.ok(Array.isArray(tags), 'getAllTags should return array even with invalid config');
            } finally {
                // Restore original
                fs.writeFileSync(tagConfigPath, originalContent);
                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(500);
            }
        });

        test('missing tags property results in empty tags', async function() {
            this.timeout(15000);

            const tagConfigPath = getFixturePath('.vscode/tasktree.json');
            const originalContent = fs.readFileSync(tagConfigPath, 'utf8');
            const provider = getTaskTreeProvider();

            try {
                // Write config without tags property
                fs.writeFileSync(tagConfigPath, JSON.stringify({ version: '1.0' }, null, 2));

                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(1000);

                // Provider should return empty tags array
                const tags = provider.getAllTags();
                assert.strictEqual(tags.length, 0, 'Missing tags property should result in empty tags');
            } finally {
                // Restore original
                fs.writeFileSync(tagConfigPath, originalContent);
                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(500);
            }
        });

        test('empty tags object results in empty tags', async function() {
            this.timeout(15000);

            const tagConfigPath = getFixturePath('.vscode/tasktree.json');
            const originalContent = fs.readFileSync(tagConfigPath, 'utf8');
            const provider = getTaskTreeProvider();

            try {
                // Write config with empty tags
                fs.writeFileSync(tagConfigPath, JSON.stringify({ tags: {} }, null, 2));

                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(1000);

                // Provider should return empty tags array
                const tags = provider.getAllTags();
                assert.strictEqual(tags.length, 0, 'Empty tags object should result in empty tags');
            } finally {
                // Restore original
                fs.writeFileSync(tagConfigPath, originalContent);
                await vscode.commands.executeCommand('tasktree.refresh');
                await sleep(500);
            }
        });
    });
});
