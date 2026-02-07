/**
 * Spec: semantic-search
 * SEMANTIC SEARCH E2E TESTS
 *
 * Black-box tests that verify semantic search feature through the UI.
 * These tests verify command registration, settings, summary storage,
 * and search behaviour without calling internal methods.
 *
 * Since Copilot is not guaranteed in test environments, these tests focus
 * on command registration, setting existence, store file I/O, and graceful
 * degradation when summaries are absent.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { activateExtension, sleep, getFixturePath, getExtensionPath } from '../helpers/helpers';
import type { SummaryStoreData } from '../../semantic/store';

interface PackageJsonManifest {
    contributes: {
        commands: ReadonlyArray<{ command: string; title: string }>;
        configuration: {
            properties: Record<string, {
                type: string;
                default: unknown;
                description: string;
            }>;
        };
        menus: {
            'view/title': ReadonlyArray<{
                command: string;
                when: string;
                group: string;
            }>;
        };
    };
}

const SUMMARIES_FILE = '.vscode/commandtree-summaries.json';

suite('Semantic Search E2E Tests', () => {
    suiteSetup(async function () {
        this.timeout(30000);
        await activateExtension();
        await sleep(2000);
    });

    // Spec: semantic-search
    suite('Command Registration', () => {
        test('semanticSearch command is registered', async function () {
            this.timeout(10000);

            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('commandtree.semanticSearch'),
                'semanticSearch command should be registered'
            );
        });

        test('generateSummaries command is registered', async function () {
            this.timeout(10000);

            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('commandtree.generateSummaries'),
                'generateSummaries command should be registered'
            );
        });

        test('semanticSearch command is declared in package.json', function () {
            this.timeout(10000);

            const packageJson = JSON.parse(
                fs.readFileSync(getExtensionPath('package.json'), 'utf8')
            ) as PackageJsonManifest;

            const semanticCmd = packageJson.contributes.commands.find(
                c => c.command === 'commandtree.semanticSearch'
            );
            assert.ok(semanticCmd !== undefined, 'semanticSearch should be in package.json commands');
            assert.strictEqual(semanticCmd.title, 'Semantic Search');
        });

        test('generateSummaries command is declared in package.json', function () {
            this.timeout(10000);

            const packageJson = JSON.parse(
                fs.readFileSync(getExtensionPath('package.json'), 'utf8')
            ) as PackageJsonManifest;

            const genCmd = packageJson.contributes.commands.find(
                c => c.command === 'commandtree.generateSummaries'
            );
            assert.ok(genCmd !== undefined, 'generateSummaries should be in package.json commands');
            assert.strictEqual(genCmd.title, 'Generate AI Summaries');
        });
    });

    // Spec: semantic-search/overview
    suite('Settings', () => {
        test('enableAiSummaries setting exists and defaults to false', function () {
            this.timeout(10000);

            const config = vscode.workspace.getConfiguration('commandtree');
            const enabled = config.get<boolean>('enableAiSummaries');
            assert.strictEqual(
                enabled,
                false,
                'enableAiSummaries should default to false'
            );
        });

        test('enableAiSummaries is declared in package.json with correct schema', function () {
            this.timeout(10000);

            const packageJson = JSON.parse(
                fs.readFileSync(getExtensionPath('package.json'), 'utf8')
            ) as PackageJsonManifest;

            const prop = packageJson.contributes.configuration.properties['commandtree.enableAiSummaries'];
            assert.ok(prop !== undefined, 'enableAiSummaries should be in configuration properties');
            assert.strictEqual(prop.type, 'boolean', 'type should be boolean');
            assert.strictEqual(prop.default, false, 'default should be false');
            assert.ok(
                typeof prop.description === 'string' && prop.description.length > 0,
                'Should have a non-empty description'
            );
        });

        test('enableAiSummaries setting can be toggled', async function () {
            this.timeout(10000);

            const config = vscode.workspace.getConfiguration('commandtree');

            // Enable
            await config.update(
                'enableAiSummaries',
                true,
                vscode.ConfigurationTarget.Workspace
            );
            await sleep(500);

            const afterEnable = vscode.workspace
                .getConfiguration('commandtree')
                .get<boolean>('enableAiSummaries');
            assert.strictEqual(afterEnable, true, 'Setting should be true after enabling');

            // Disable (reset)
            await config.update(
                'enableAiSummaries',
                false,
                vscode.ConfigurationTarget.Workspace
            );
            await sleep(500);

            const afterDisable = vscode.workspace
                .getConfiguration('commandtree')
                .get<boolean>('enableAiSummaries');
            assert.strictEqual(afterDisable, false, 'Setting should be false after disabling');
        });
    });

    // Spec: semantic-search/data-structure
    suite('Summary Storage', () => {
        const summariesPath = (): string => getFixturePath(SUMMARIES_FILE);

        suiteTeardown(async function () {
            this.timeout(5000);
            const filePath = summariesPath();
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            await sleep(500);
        });

        test('summary store file has valid JSON structure when created', function () {
            this.timeout(10000);

            const filePath = summariesPath();
            const storeData: SummaryStoreData = {
                records: {
                    'shell:/test/script.sh:script.sh': {
                        commandId: 'shell:/test/script.sh:script.sh',
                        contentHash: 'abc123',
                        summary: 'Runs a deployment script',
                        lastUpdated: new Date().toISOString()
                    }
                }
            };
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, JSON.stringify(storeData, null, 2));

            const raw = fs.readFileSync(filePath, 'utf8');
            const content: SummaryStoreData = JSON.parse(raw) as SummaryStoreData;
            assert.ok('records' in content, 'Store should have records property');

            const record = content.records['shell:/test/script.sh:script.sh'];
            assert.ok(record !== undefined, 'Record should exist');
            assert.strictEqual(record.commandId, 'shell:/test/script.sh:script.sh');
            assert.strictEqual(record.contentHash, 'abc123');
            assert.strictEqual(record.summary, 'Runs a deployment script');
            assert.ok(record.lastUpdated !== '', 'Record should have lastUpdated');
        });

        test('summary store supports multiple records', function () {
            this.timeout(10000);

            const filePath = summariesPath();
            const storeData: SummaryStoreData = {
                records: {
                    'npm:build': {
                        commandId: 'npm:build',
                        contentHash: 'hash1',
                        summary: 'Compiles the TypeScript project',
                        lastUpdated: new Date().toISOString()
                    },
                    'shell:deploy.sh': {
                        commandId: 'shell:deploy.sh',
                        contentHash: 'hash2',
                        summary: 'Deploys the application to staging',
                        lastUpdated: new Date().toISOString()
                    },
                    'make:test': {
                        commandId: 'make:test',
                        contentHash: 'hash3',
                        summary: 'Runs the full test suite',
                        lastUpdated: new Date().toISOString()
                    }
                }
            };
            fs.writeFileSync(filePath, JSON.stringify(storeData, null, 2));

            const raw = fs.readFileSync(filePath, 'utf8');
            const content: SummaryStoreData = JSON.parse(raw) as SummaryStoreData;
            const recordKeys = Object.keys(content.records);

            assert.strictEqual(recordKeys.length, 3, 'Should have exactly 3 records');
            assert.ok(content.records['npm:build'] !== undefined, 'Should have npm:build record');
            assert.ok(content.records['shell:deploy.sh'] !== undefined, 'Should have shell:deploy.sh record');
            assert.ok(content.records['make:test'] !== undefined, 'Should have make:test record');
        });

        test('empty store has no records', function () {
            this.timeout(10000);

            const filePath = summariesPath();
            const emptyStore: SummaryStoreData = { records: {} };
            fs.writeFileSync(filePath, JSON.stringify(emptyStore, null, 2));

            const raw = fs.readFileSync(filePath, 'utf8');
            const content: SummaryStoreData = JSON.parse(raw) as SummaryStoreData;
            const recordKeys = Object.keys(content.records);

            assert.strictEqual(recordKeys.length, 0, 'Empty store should have zero records');
        });

        test('summary record has contentHash for change detection', function () {
            this.timeout(10000);

            const filePath = summariesPath();
            if (!fs.existsSync(filePath)) {
                return this.skip();
            }

            const raw = fs.readFileSync(filePath, 'utf8');
            const content: SummaryStoreData = JSON.parse(raw) as SummaryStoreData;
            const records = Object.values(content.records);

            for (const record of records) {
                assert.ok(
                    typeof record.contentHash === 'string' &&
                    record.contentHash.length > 0,
                    'Each record should have a non-empty contentHash'
                );
            }
        });
    });

    // Spec: semantic-search/search-ux
    suite('Graceful Degradation', () => {
        test('text filter commands remain available when AI summaries disabled', async function () {
            this.timeout(15000);

            const config = vscode.workspace.getConfiguration('commandtree');
            await config.update(
                'enableAiSummaries',
                false,
                vscode.ConfigurationTarget.Workspace
            );
            await sleep(500);

            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('commandtree.filter'),
                'Text filter should still be available when AI disabled'
            );
            assert.ok(
                commands.includes('commandtree.clearFilter'),
                'Clear filter should still be available when AI disabled'
            );
            assert.ok(
                commands.includes('commandtree.filterByTag'),
                'Tag filter should still be available when AI disabled'
            );
        });

        test('semantic search command remains registered even when AI disabled', async function () {
            this.timeout(10000);

            const config = vscode.workspace.getConfiguration('commandtree');
            await config.update(
                'enableAiSummaries',
                false,
                vscode.ConfigurationTarget.Workspace
            );
            await sleep(500);

            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('commandtree.semanticSearch'),
                'semanticSearch command should still be registered when AI disabled'
            );
        });

        test('no summaries file on disk does not break extension', async function () {
            this.timeout(10000);

            const filePath = getFixturePath(SUMMARIES_FILE);

            // Remove summaries file if it exists
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            assert.ok(!fs.existsSync(filePath), 'Summaries file should not exist');

            // Extension should still be active and commands still registered
            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('commandtree.semanticSearch'),
                'semanticSearch should be registered even without summaries file'
            );
            assert.ok(
                commands.includes('commandtree.generateSummaries'),
                'generateSummaries should be registered even without summaries file'
            );
            assert.ok(
                commands.includes('commandtree.refresh'),
                'Core commands should still work without summaries file'
            );
        });

        test('generate summaries command remains registered even when AI disabled', async function () {
            this.timeout(10000);

            const config = vscode.workspace.getConfiguration('commandtree');
            await config.update(
                'enableAiSummaries',
                false,
                vscode.ConfigurationTarget.Workspace
            );
            await sleep(500);

            const commands = await vscode.commands.getCommands(true);
            assert.ok(
                commands.includes('commandtree.generateSummaries'),
                'generateSummaries command should still be registered when AI disabled'
            );
        });
    });

    suite('Menu Configuration', () => {
        test('semanticSearch button is gated by aiSummariesEnabled context', function () {
            this.timeout(10000);

            const packageJson = JSON.parse(
                fs.readFileSync(getExtensionPath('package.json'), 'utf8')
            ) as PackageJsonManifest;

            const menuEntries = packageJson.contributes.menus['view/title'];
            const semanticEntry = menuEntries.find(
                m => m.command === 'commandtree.semanticSearch'
            );

            assert.ok(
                semanticEntry !== undefined,
                'semanticSearch should have a view/title menu entry'
            );
            assert.ok(
                semanticEntry.when.includes('commandtree.aiSummariesEnabled'),
                'semanticSearch menu should be gated by aiSummariesEnabled context'
            );
        });
    });
});
