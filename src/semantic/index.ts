/**
 * Semantic search orchestration.
 * Coordinates LLM summarisation, embedding generation, and SQLite storage.
 */

import * as vscode from 'vscode';
import type { TaskItem, Result } from '../models/TaskItem';
import { ok, err } from '../models/TaskItem';
import { logger } from '../utils/logger';
import { readFile } from '../utils/fileUtils';
import { computeContentHash } from './store';
import { selectCopilotModel, summariseScript } from './summariser';
import { initDb, getDb, getOrCreateEmbedder, disposeSemantic } from './lifecycle';
import { getAllRows, upsertRow, getRow, importFromJsonStore } from './db';
import type { EmbeddingRow } from './db';
import { embedText } from './embedder';
import { rankBySimilarity } from './similarity';
import {
    legacyStoreExists,
    readSummaryStore,
    deleteLegacyJsonStore
} from './store';

const SEARCH_TOP_K = 20;
const SEARCH_SIMILARITY_THRESHOLD = 0.3;

/**
 * Checks if the user has enabled AI summaries.
 */
export function isAiEnabled(): boolean {
    return vscode.workspace
        .getConfiguration('commandtree')
        .get<boolean>('enableAiSummaries', false);
}

/**
 * Initialises the semantic search subsystem.
 */
export async function initSemanticStore(workspaceRoot: string): Promise<Result<void, string>> {
    const result = await initDb(workspaceRoot);
    return result.ok ? ok(undefined) : err(result.error);
}

/**
 * Disposes all semantic search resources.
 */
export async function disposeSemanticStore(): Promise<void> {
    await disposeSemantic();
}

/**
 * Migrates legacy JSON store to SQLite if needed.
 */
export async function migrateIfNeeded(params: {
    readonly workspaceRoot: string;
}): Promise<Result<void, string>> {
    const exists = await legacyStoreExists(params.workspaceRoot);
    if (!exists) { return ok(undefined); }

    const dbResult = getDb();
    if (!dbResult.ok) { return err(dbResult.error); }

    const storeResult = await readSummaryStore(params.workspaceRoot);
    if (!storeResult.ok) { return ok(undefined); }

    const importResult = importFromJsonStore({
        handle: dbResult.value,
        jsonData: storeResult.value
    });

    if (!importResult.ok) { return err(importResult.error); }

    logger.info('Migrated JSON store to SQLite', { count: importResult.value });
    const deleteResult = await deleteLegacyJsonStore(params.workspaceRoot);
    if (!deleteResult.ok) {
        logger.warn('Could not delete legacy store', { error: deleteResult.error });
    }
    return ok(undefined);
}

/**
 * Reads script content for a task.
 */
async function readTaskContent(task: TaskItem): Promise<string> {
    const uri = vscode.Uri.file(task.filePath);
    const result = await readFile(uri);
    return result.ok ? result.value : task.command;
}

/**
 * Gets a summary for a task via Copilot.
 * NO FALLBACK. If Copilot is unavailable, callers MUST NOT reach here.
 * Fake metadata summaries let tests pass without real AI — that is fraud.
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
 * Summarises and embeds a single task, storing in SQLite.
 * NO FALLBACK: model must be real Copilot, embedding must succeed.
 * Storing null embeddings lets tests pass via fallbackTextSearch — that is fraud.
 */
async function processOneTask(params: {
    readonly model: vscode.LanguageModelChat;
    readonly task: TaskItem;
    readonly content: string;
    readonly hash: string;
    readonly workspaceRoot: string;
}): Promise<Result<void, string>> {
    const summary = await getSummary(params);
    if (summary === null) { return ok(undefined); }

    const embedding = await embedOrFail({ text: summary, workspaceRoot: params.workspaceRoot });
    if (!embedding.ok) { return err(embedding.error); }

    const dbResult = getDb();
    if (!dbResult.ok) { return err(dbResult.error); }

    return upsertRow({
        handle: dbResult.value,
        row: {
            commandId: params.task.id,
            contentHash: params.hash,
            summary,
            embedding: embedding.value,
            lastUpdated: new Date().toISOString()
        }
    });
}

/**
 * Embeds text into a vector. Returns error on failure — NEVER null.
 * Silently returning null lets rows get stored without embeddings,
 * which lets search fall to dumb text matching. That is fraud.
 */
async function embedOrFail(params: {
    readonly text: string;
    readonly workspaceRoot: string;
}): Promise<Result<Float32Array, string>> {
    const embedderResult = await getOrCreateEmbedder({
        workspaceRoot: params.workspaceRoot
    });
    if (!embedderResult.ok) { return err(embedderResult.error); }

    return await embedText({
        handle: embedderResult.value,
        text: params.text
    });
}

/**
 * Summarises all tasks that are new or have changed.
 * NO FALLBACK: requires real Copilot model. Without it, returns error.
 * Silently degrading to metadata strings lets tests pass without AI — fraud.
 */
export async function summariseAllTasks(params: {
    readonly tasks: readonly TaskItem[];
    readonly workspaceRoot: string;
    readonly onProgress?: (done: number, total: number) => void;
}): Promise<Result<number, string>> {
    const modelResult = await selectCopilotModel();
    if (!modelResult.ok) { return err(modelResult.error); }

    const dbResult = getDb();
    if (!dbResult.ok) { return err(dbResult.error); }

    const pending = await findPending(params.tasks);
    if (pending.length === 0) {
        logger.info('All summaries up to date');
        return ok(0);
    }

    logger.info('Summarising tasks', { count: pending.length });
    let done = 0;

    for (const item of pending) {
        await processOneTask({
            model: modelResult.value,
            task: item.task,
            content: item.content,
            hash: item.hash,
            workspaceRoot: params.workspaceRoot
        });
        done++;
        params.onProgress?.(done, pending.length);
    }

    return ok(done);
}

interface PendingItem {
    readonly task: TaskItem;
    readonly content: string;
    readonly hash: string;
}

/**
 * Finds tasks that need summarisation (new or changed).
 */
async function findPending(tasks: readonly TaskItem[]): Promise<PendingItem[]> {
    const dbResult = getDb();
    if (!dbResult.ok) { return []; }

    const pending: PendingItem[] = [];
    for (const task of tasks) {
        const content = await readTaskContent(task);
        const hash = computeContentHash(content);
        const existing = getRow({ handle: dbResult.value, commandId: task.id });
        const needsWork = !existing.ok
            || existing.value?.contentHash !== hash
            || existing.value.embedding === null;
        if (needsWork) {
            pending.push({ task, content, hash });
        }
    }
    return pending;
}

/**
 * Performs semantic search using cosine similarity on stored embeddings.
 * NO FALLBACK: if embedder fails, returns error. No dumb text matching.
 * fallbackTextSearch was string.includes() on metadata — pure fraud.
 */
export async function semanticSearch(params: {
    readonly query: string;
    readonly workspaceRoot: string;
}): Promise<Result<string[], string>> {
    const dbResult = getDb();
    if (!dbResult.ok) { return err(dbResult.error); }

    const rowsResult = getAllRows(dbResult.value);
    if (!rowsResult.ok) { return err(rowsResult.error); }

    if (rowsResult.value.length === 0) { return ok([]); }

    const embResult = await embedOrFail({
        text: params.query,
        workspaceRoot: params.workspaceRoot
    });
    if (!embResult.ok) { return err(embResult.error); }

    const candidates = rowsResult.value.map(r => ({
        id: r.commandId,
        embedding: r.embedding
    }));

    const ranked = rankBySimilarity({
        query: embResult.value,
        candidates,
        topK: SEARCH_TOP_K,
        threshold: SEARCH_SIMILARITY_THRESHOLD
    });

    return ok(ranked.map(r => r.id));
}

/**
 * Gets all embedding rows for the CommandTreeProvider to read summaries.
 */
export function getAllEmbeddingRows(): Result<EmbeddingRow[], string> {
    const dbResult = getDb();
    if (!dbResult.ok) { return err(dbResult.error); }
    return getAllRows(dbResult.value);
}

