/**
 * Singleton lifecycle management for the semantic search subsystem.
 * Manages database and embedder handles.
 */

import * as path from 'path';
import type { Result } from '../models/TaskItem';
import { ok, err } from '../models/TaskItem';
import { logger } from '../utils/logger';
import type { DbHandle } from './db';
import { openDatabase, initSchema, closeDatabase } from './db';
import type { EmbedderHandle } from './embedder';
import { createEmbedder, disposeEmbedder } from './embedder';

const COMMANDTREE_DIR = '.commandtree';
const DB_FILENAME = 'commandtree.sqlite3';
const MODEL_DIR = 'models';

let dbHandle: DbHandle | null = null;
let embedderHandle: EmbedderHandle | null = null;

/**
 * Initialises the SQLite database singleton.
 */
export function initDb(workspaceRoot: string): Result<DbHandle, string> {
    if (dbHandle !== null) {
        return ok(dbHandle);
    }

    const dbPath = path.join(workspaceRoot, COMMANDTREE_DIR, DB_FILENAME);
    const openResult = openDatabase(dbPath);
    if (!openResult.ok) { return openResult; }

    const schemaResult = initSchema(openResult.value);
    if (!schemaResult.ok) {
        closeDatabase(openResult.value);
        return err(schemaResult.error);
    }

    dbHandle = openResult.value;
    logger.info('SQLite database initialised', { path: dbPath });
    return ok(dbHandle);
}

/**
 * Returns the current database handle.
 */
export function getDb(): Result<DbHandle, string> {
    return dbHandle !== null
        ? ok(dbHandle)
        : err('Database not initialised. Call initDb first.');
}

/**
 * Gets or creates the embedder singleton.
 */
export async function getOrCreateEmbedder(params: {
    readonly workspaceRoot: string;
    readonly onProgress?: (progress: unknown) => void;
}): Promise<Result<EmbedderHandle, string>> {
    if (embedderHandle !== null) {
        return ok(embedderHandle);
    }

    const modelDir = path.join(params.workspaceRoot, COMMANDTREE_DIR, MODEL_DIR);
    const embedderParams = params.onProgress !== undefined
        ? { modelCacheDir: modelDir, onProgress: params.onProgress }
        : { modelCacheDir: modelDir };
    const result = await createEmbedder(embedderParams);

    if (result.ok) {
        embedderHandle = result.value;
    }
    return result;
}

/**
 * Disposes all semantic search resources.
 */
export async function disposeSemantic(): Promise<void> {
    if (embedderHandle !== null) {
        await disposeEmbedder(embedderHandle);
        embedderHandle = null;
    }
    if (dbHandle !== null) {
        closeDatabase(dbHandle);
        dbHandle = null;
    }
    logger.info('Semantic search resources disposed');
}
