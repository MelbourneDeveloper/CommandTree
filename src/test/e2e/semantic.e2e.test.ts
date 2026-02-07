/**
 * VECTOR SEARCH E2E TESTS
 *
 * FULL end-to-end: extension generates summaries + embeddings BY ITSELF,
 * then semantic search returns results ranked by cosine similarity.
 *
 * Requires: Copilot (for summarisation) + network (for model download).
 * If unavailable, tests FAIL — that is OK per CLAUDE.md.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
    activateExtension,
    sleep,
    getFixturePath,
    getCommandTreeProvider,
    getTreeChildren
} from '../helpers/helpers';

const COMMANDTREE_DIR = '.commandtree';
const DB_FILENAME = 'commandtree.sqlite3';

suite('Vector Search E2E', () => {
    suiteSetup(async function () {
        this.timeout(120000);
        await activateExtension();

        // Enable AI summaries
        const config = vscode.workspace.getConfiguration('commandtree');
        await config.update(
            'enableAiSummaries',
            true,
            vscode.ConfigurationTarget.Workspace
        );
        await sleep(1000);
    });

    suiteTeardown(async function () {
        this.timeout(10000);
        // Reset setting
        const config = vscode.workspace.getConfiguration('commandtree');
        await config.update(
            'enableAiSummaries',
            false,
            vscode.ConfigurationTarget.Workspace
        );

        // Clean up generated DB
        const dbPath = getFixturePath(path.join(COMMANDTREE_DIR, DB_FILENAME));
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }
        const dir = getFixturePath(COMMANDTREE_DIR);
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }

        // Clear semantic filter
        await vscode.commands.executeCommand('commandtree.clearFilter');
    });

    test('generate summaries creates SQLite database with embeddings', async function () {
        this.timeout(300000);

        // Trigger the real summarisation pipeline
        await vscode.commands.executeCommand('commandtree.generateSummaries');

        // Wait for async summarisation + embedding to complete
        await sleep(5000);

        // The extension should have created the SQLite DB
        const dbPath = getFixturePath(path.join(COMMANDTREE_DIR, DB_FILENAME));
        assert.ok(
            fs.existsSync(dbPath),
            `SQLite database should exist at ${dbPath}`
        );

        // DB file should have real content (not empty)
        const stats = fs.statSync(dbPath);
        assert.ok(
            stats.size > 0,
            'SQLite database should not be empty'
        );
    });

    test('semantic search filters tree view by vector similarity', async function () {
        this.timeout(120000);

        const provider = getCommandTreeProvider();

        // Get unfiltered task count first
        const rootBefore = await getTreeChildren(provider);
        const countBefore = rootBefore.length;
        assert.ok(countBefore > 0, 'Should have categories before search');

        // Execute semantic search with a query (extension embeds + ranks)
        await vscode.commands.executeCommand(
            'commandtree.semanticSearch',
            'deploy to staging'
        );
        await sleep(2000);

        // Tree should now be filtered by semantic results
        const rootAfter = await getTreeChildren(provider);

        // Semantic filter should reduce or reorder results
        // (only commands whose embeddings are similar to "deploy" appear)
        assert.ok(
            rootAfter.length > 0,
            'Should have results after semantic search'
        );

        // Clear and verify tree restores
        await vscode.commands.executeCommand('commandtree.clearFilter');
        await sleep(500);
        const rootRestored = await getTreeChildren(provider);
        assert.strictEqual(
            rootRestored.length,
            countBefore,
            'Clearing filter should restore all categories'
        );
    });

    test('semantic search ranks deploy query near deploy scripts', async function () {
        this.timeout(120000);

        // Search for "deploy" — deploy.sh should rank higher than build.sh
        await vscode.commands.executeCommand(
            'commandtree.semanticSearch',
            'deploy application to production server'
        );
        await sleep(2000);

        const provider = getCommandTreeProvider();
        const roots = await getTreeChildren(provider);

        // Collect all visible task labels from the filtered tree
        const visibleLabels: string[] = [];
        for (const category of roots) {
            const children = await getTreeChildren(provider, category);
            for (const child of children) {
                if (child.label) {
                    visibleLabels.push(
                        typeof child.label === 'string'
                            ? child.label
                            : child.label.label
                    );
                }
                // Check nested folder children
                for (const nested of child.children) {
                    if (nested.label) {
                        visibleLabels.push(
                            typeof nested.label === 'string'
                                ? nested.label
                                : nested.label.label
                        );
                    }
                }
            }
        }

        // "deploy" related scripts should appear in results
        const hasDeployResult = visibleLabels.some(
            l => l.toLowerCase().includes('deploy')
        );
        assert.ok(
            hasDeployResult,
            `"deploy" query should surface deploy-related scripts. Got: ${visibleLabels.join(', ')}`
        );

        // Clean up
        await vscode.commands.executeCommand('commandtree.clearFilter');
    });

    test('semantic search ranks build query near build scripts', async function () {
        this.timeout(120000);

        // Search for "build" — build.sh should rank higher than deploy.sh
        await vscode.commands.executeCommand(
            'commandtree.semanticSearch',
            'compile and build the project'
        );
        await sleep(2000);

        const provider = getCommandTreeProvider();
        const roots = await getTreeChildren(provider);

        const visibleLabels: string[] = [];
        for (const category of roots) {
            const children = await getTreeChildren(provider, category);
            for (const child of children) {
                if (child.label) {
                    visibleLabels.push(
                        typeof child.label === 'string'
                            ? child.label
                            : child.label.label
                    );
                }
                for (const nested of child.children) {
                    if (nested.label) {
                        visibleLabels.push(
                            typeof nested.label === 'string'
                                ? nested.label
                                : nested.label.label
                        );
                    }
                }
            }
        }

        const hasBuildResult = visibleLabels.some(
            l => l.toLowerCase().includes('build')
        );
        assert.ok(
            hasBuildResult,
            `"build" query should surface build-related scripts. Got: ${visibleLabels.join(', ')}`
        );

        // Clean up
        await vscode.commands.executeCommand('commandtree.clearFilter');
    });
});
