/**
 * SPEC: database-schema
 * Singleton lifecycle management for the database.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Result } from '../models/Result';
import { ok, err } from '../models/Result';
import { logger } from '../utils/logger';
import type { DbHandle } from './db';
import { openDatabase, initSchema, closeDatabase } from './db';

const COMMANDTREE_DIR = '.commandtree';
const DB_FILENAME = 'commandtree.sqlite3';

let dbHandle: DbHandle | null = null;

/**
 * Initialises the SQLite database singleton.
 * Re-creates if the DB file was deleted externally.
 */
export function initDb(workspaceRoot: string): Result<DbHandle, string> {
    if (dbHandle !== null && fs.existsSync(dbHandle.path)) {
        return ok(dbHandle);
    }
    resetStaleHandle();

    const dbDir = path.join(workspaceRoot, COMMANDTREE_DIR);
    try {
        fs.mkdirSync(dbDir, { recursive: true });
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to create directory';
        return err(msg);
    }

    const dbPath = path.join(dbDir, DB_FILENAME);
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
 * Invalidates a stale handle if the DB file was deleted.
 */
export function getDb(): Result<DbHandle, string> {
    if (dbHandle !== null && fs.existsSync(dbHandle.path)) {
        return ok(dbHandle);
    }
    resetStaleHandle();
    return err('Database not initialised. Call initDb first.');
}

function resetStaleHandle(): void {
    if (dbHandle !== null) {
        closeDatabase(dbHandle);
        dbHandle = null;
    }
}

/**
 * Disposes the database connection.
 */
export function disposeDb(): void {
    const currentDb = dbHandle;
    dbHandle = null;
    if (currentDb !== null) {
        closeDatabase(currentDb);
    }
    logger.info('Database disposed');
}
