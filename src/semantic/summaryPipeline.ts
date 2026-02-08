/**
 * SPEC: ai-summary-generation
 *
 * Summary pipeline: generates Copilot summaries and stores them in SQLite.
 * COMPLETELY DECOUPLED from embedding generation.
 * Does NOT import embedder, similarity, or embeddingPipeline.
 */

import type * as vscode from 'vscode';
import type { TaskItem, Result } from '../models/TaskItem';
import { ok, err } from '../models/TaskItem';
import { logger } from '../utils/logger';
import { computeContentHash } from './store';
import type { FileSystemAdapter } from './adapters';
import { selectCopilotModel, summariseScript } from './summariser';
import { initDb } from './lifecycle';
import { upsertSummary, getRow } from './db';
import type { DbHandle } from './db';

interface PendingItem {
    readonly task: TaskItem;
    readonly content: string;
    readonly hash: string;
}

/**
 * Reads script content for a task using the provided file system adapter.
 */
async function readTaskContent(params: {
    readonly task: TaskItem;
    readonly fs: FileSystemAdapter;
}): Promise<string> {
    const result = await params.fs.readFile(params.task.filePath);
    return result.ok ? result.value : params.task.command;
}

/**
 * Finds tasks that need a new or updated summary.
 */
async function findPendingSummaries(params: {
    readonly handle: DbHandle;
    readonly tasks: readonly TaskItem[];
    readonly fs: FileSystemAdapter;
}): Promise<PendingItem[]> {
    const pending: PendingItem[] = [];
    for (const task of params.tasks) {
        const content = await readTaskContent({ task, fs: params.fs });
        const hash = computeContentHash(content);
        const existing = getRow({ handle: params.handle, commandId: task.id });
        const needsSummary = !existing.ok
            || existing.value?.contentHash !== hash;
        if (needsSummary) {
            pending.push({ task, content, hash });
        }
    }
    return pending;
}

/**
 * Gets a summary for a task via Copilot.
 * NO FALLBACK. If Copilot is unavailable, returns null.
 */
async function getSummary(params: {
    readonly model: vscode.LanguageModelChat;
    readonly task: TaskItem;
    readonly content: string;
}): Promise<string | null> {
    const result = await summariseScript({
        model: params.model,
        label: params.task.label,
        type: params.task.type,
        command: params.task.command,
        content: params.content
    });
    return result.ok ? result.value : null;
}

/**
 * Summarises a single task and stores the summary in SQLite.
 * Does NOT generate embeddings.
 */
async function processOneSummary(params: {
    readonly model: vscode.LanguageModelChat;
    readonly task: TaskItem;
    readonly content: string;
    readonly hash: string;
    readonly handle: DbHandle;
}): Promise<Result<void, string>> {
    const summary = await getSummary(params);
    if (summary === null) { return err('Copilot summary failed'); }

    return upsertSummary({
        handle: params.handle,
        commandId: params.task.id,
        contentHash: params.hash,
        summary
    });
}

/**
 * Summarises all tasks that are new or have changed content.
 * Stores summaries in SQLite. Does NOT touch embeddings.
 */
export async function summariseAllTasks(params: {
    readonly tasks: readonly TaskItem[];
    readonly workspaceRoot: string;
    readonly fs: FileSystemAdapter;
    readonly onProgress?: (done: number, total: number) => void;
}): Promise<Result<number, string>> {
    logger.info('[SUMMARY] summariseAllTasks START', {
        taskCount: params.tasks.length,
    });

    const modelResult = await selectCopilotModel();
    if (!modelResult.ok) {
        logger.error('[SUMMARY] Copilot model selection failed', { error: modelResult.error });
        return err(modelResult.error);
    }

    const dbInit = await initDb(params.workspaceRoot);
    if (!dbInit.ok) {
        logger.error('[SUMMARY] initDb failed', { error: dbInit.error });
        return err(dbInit.error);
    }

    const pending = await findPendingSummaries({
        handle: dbInit.value,
        tasks: params.tasks,
        fs: params.fs
    });
    logger.info('[SUMMARY] findPendingSummaries complete', { pendingCount: pending.length });

    if (pending.length === 0) {
        logger.info('[SUMMARY] All summaries up to date');
        return ok(0);
    }

    let succeeded = 0;
    let failed = 0;

    for (const item of pending) {
        const result = await processOneSummary({
            model: modelResult.value,
            task: item.task,
            content: item.content,
            hash: item.hash,
            handle: dbInit.value
        });
        if (result.ok) {
            succeeded++;
        } else {
            failed++;
            logger.error('[SUMMARY] Task failed', { id: item.task.id, error: result.error });
        }
        params.onProgress?.(succeeded + failed, pending.length);
    }

    logger.info('[SUMMARY] complete', { succeeded, failed });

    if (succeeded === 0 && failed > 0) {
        return err(`All ${failed} tasks failed to summarise`);
    }
    return ok(succeeded);
}
