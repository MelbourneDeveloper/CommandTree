import * as vscode from 'vscode';
import type { TaskItem, Result } from '../models/TaskItem';
import { ok, err } from '../models/TaskItem';
import { logger } from '../utils/logger';
import { readFile } from '../utils/fileUtils';
import {
    readSummaryStore,
    writeSummaryStore,
    computeContentHash,
    needsUpdate,
    getRecord,
    upsertRecord,
    getAllRecords
} from './store';
import type { SummaryStoreData, SummaryRecord } from './store';
import { selectCopilotModel, summariseScript, rankByRelevance } from './summariser';

const OPT_IN_KEY = 'commandtree.aiSummariesPrompted';

/**
 * Checks if the user has enabled AI summaries.
 */
export function isAiEnabled(): boolean {
    return vscode.workspace
        .getConfiguration('commandtree')
        .get<boolean>('enableAiSummaries', false);
}

/**
 * Prompts the user to opt in to AI summaries (first time only).
 * Returns true if the user accepted.
 */
export async function promptOptIn(
    context: vscode.ExtensionContext
): Promise<boolean> {
    const prompted = context.workspaceState.get<boolean>(OPT_IN_KEY, false);
    if (prompted || isAiEnabled()) {
        return isAiEnabled();
    }

    const choice = await vscode.window.showInformationMessage(
        'Would you like to use GitHub Copilot to summarise scripts in your workspace? This enables semantic search.',
        'Enable',
        'Not Now'
    );

    await context.workspaceState.update(OPT_IN_KEY, true);

    if (choice === 'Enable') {
        await vscode.workspace
            .getConfiguration('commandtree')
            .update('enableAiSummaries', true, vscode.ConfigurationTarget.Workspace);
        return true;
    }

    return false;
}

/**
 * Reads script content for a task, returning the file content.
 */
async function readTaskContent(task: TaskItem): Promise<string> {
    const uri = vscode.Uri.file(task.filePath);
    const result = await readFile(uri);
    if (result.ok) {
        return result.value;
    }
    return task.command;
}

/**
 * Summarises all tasks that are new or have changed.
 * Processes incrementally - only re-summarises when content hash changes.
 */
export async function summariseAllTasks(params: {
    readonly tasks: ReadonlyArray<TaskItem>;
    readonly workspaceRoot: string;
    readonly onProgress?: (done: number, total: number) => void;
}): Promise<Result<SummaryStoreData, string>> {
    const modelResult = await selectCopilotModel();
    if (!modelResult.ok) {
        return modelResult;
    }
    const model = modelResult.value;

    const storeResult = await readSummaryStore(params.workspaceRoot);
    if (!storeResult.ok) {
        return storeResult;
    }
    let store = storeResult.value;

    const tasksToSummarise: Array<{ task: TaskItem; content: string; hash: string }> = [];

    for (const task of params.tasks) {
        const content = await readTaskContent(task);
        const hash = computeContentHash(content);
        const existing = getRecord(store, task.id);

        if (needsUpdate(existing, hash)) {
            tasksToSummarise.push({ task, content, hash });
        }
    }

    if (tasksToSummarise.length === 0) {
        logger.info('All summaries up to date');
        return ok(store);
    }

    logger.info('Summarising tasks', { count: tasksToSummarise.length });

    let done = 0;
    for (const { task, content, hash } of tasksToSummarise) {
        const summaryResult = await summariseScript({
            model,
            label: task.label,
            type: task.type,
            command: task.command,
            content
        });

        if (summaryResult.ok) {
            const record: SummaryRecord = {
                commandId: task.id,
                contentHash: hash,
                summary: summaryResult.value,
                lastUpdated: new Date().toISOString()
            };
            store = upsertRecord(store, record);
        } else {
            logger.warn('Skipping task summary', {
                id: task.id,
                error: summaryResult.error
            });
        }

        done++;
        params.onProgress?.(done, tasksToSummarise.length);
    }

    const writeResult = await writeSummaryStore(params.workspaceRoot, store);
    if (!writeResult.ok) {
        return err(writeResult.error);
    }

    logger.info('Summarisation complete', {
        total: params.tasks.length,
        updated: tasksToSummarise.length
    });

    return ok(store);
}

/**
 * Performs semantic search using LLM-based relevance ranking.
 * Falls back to text matching on summaries if LLM is unavailable.
 */
export async function semanticSearch(params: {
    readonly query: string;
    readonly workspaceRoot: string;
}): Promise<Result<string[], string>> {
    const storeResult = await readSummaryStore(params.workspaceRoot);
    if (!storeResult.ok) {
        return storeResult;
    }

    const records = getAllRecords(storeResult.value);
    if (records.length === 0) {
        return ok([]);
    }

    const modelResult = await selectCopilotModel();
    if (!modelResult.ok) {
        return fallbackTextSearch(records, params.query);
    }

    const candidates = records.map(r => ({
        id: r.commandId,
        summary: r.summary
    }));

    return await rankByRelevance({
        model: modelResult.value,
        query: params.query,
        candidates
    });
}

/**
 * Simple text search fallback on summaries when LLM is unavailable.
 */
function fallbackTextSearch(
    records: ReadonlyArray<SummaryRecord>,
    query: string
): Result<string[], string> {
    const lower = query.toLowerCase();
    const matched = records
        .filter(r => r.summary.toLowerCase().includes(lower))
        .map(r => r.commandId);
    return ok(matched);
}
