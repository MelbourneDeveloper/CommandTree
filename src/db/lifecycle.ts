/**
 * SPEC: database-schema, DB-LOCK-RECOVERY
 * Singleton lifecycle management for the database.
 */

import * as fs from "fs";
import * as path from "path";
import { logger } from "../utils/logger";
import type { DbHandle } from "./db";
import { openDatabase, initSchema, closeDatabase } from "./db";
import type { Result } from "../models/Result";
import { ok, err } from "../models/Result";

const COMMANDTREE_DIR = ".commandtree";
const DB_FILENAME = "commandtree.sqlite3";
const LOCK_RETRY_INTERVAL_MS = 1000;
const LOCK_RETRY_MAX_MS = 10000;
const JOURNAL_SUFFIX = "-journal";
const WAL_SUFFIX = "-wal";
const SHM_SUFFIX = "-shm";
const LOCK_DIR_SUFFIX = ".lock";

let dbHandle: DbHandle | null = null;

/**
 * SPEC: DB-LOCK-RECOVERY
 * Initialises the SQLite database singleton.
 * If the database is locked, retries for 10 seconds then
 * forcefully removes lock/journal files and retries.
 */
export async function initDb(workspaceRoot: string): Promise<Result<DbHandle, string>> {
  if (dbHandle !== null && fs.existsSync(dbHandle.path)) {
    return ok(dbHandle);
  }
  resetStaleHandle();

  const dbDir = path.join(workspaceRoot, COMMANDTREE_DIR);
  fs.mkdirSync(dbDir, { recursive: true });

  const dbPath = path.join(dbDir, DB_FILENAME);
  const result = tryOpenAndInit(dbPath);
  if (result.ok) {
    return result;
  }

  if (!isLockError(result.error)) {
    return result;
  }

  logger.warn("Database locked, retrying", { dbPath });
  const retryResult = await retryWithBackoff(dbPath);
  if (retryResult.ok) {
    return retryResult;
  }

  logger.warn("Retries exhausted, force-removing lock files", { dbPath });
  removeLockFiles(dbPath);
  return tryOpenAndInit(dbPath);
}

/**
 * Returns the current database handle.
 * Returns error if the database has not been initialised.
 */
export function getDb(): Result<DbHandle, string> {
  if (dbHandle !== null && fs.existsSync(dbHandle.path)) {
    return ok(dbHandle);
  }
  resetStaleHandle();
  return err("Database not initialised. Call initDb first.");
}

/**
 * Returns the database handle, throwing if not initialised.
 * Use this in code paths where the DB is guaranteed to be available.
 */
export function getDbOrThrow(): DbHandle {
  const result = getDb();
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
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
  logger.info("Database disposed");
}

function tryOpenAndInit(dbPath: string): Result<DbHandle, string> {
  const openResult = openDatabase(dbPath);
  if (!openResult.ok) {
    return openResult;
  }
  try {
    initSchema(openResult.value);
  } catch (e: unknown) {
    closeDatabase(openResult.value);
    const msg = e instanceof Error ? e.message : String(e);
    return err(msg);
  }
  dbHandle = openResult.value;
  logger.info("SQLite database initialised", { path: dbPath });
  return ok(openResult.value);
}

function isLockError(message: string): boolean {
  return message.includes("locked") || message.includes("SQLITE_BUSY");
}

async function retryWithBackoff(dbPath: string): Promise<Result<DbHandle, string>> {
  let elapsed = 0;
  let lastError = "database is locked";
  while (elapsed < LOCK_RETRY_MAX_MS) {
    await sleep(LOCK_RETRY_INTERVAL_MS);
    elapsed += LOCK_RETRY_INTERVAL_MS;
    logger.info("Lock retry attempt", { elapsedMs: elapsed });
    const result = tryOpenAndInit(dbPath);
    if (result.ok) {
      return result;
    }
    lastError = result.error;
    if (!isLockError(lastError)) {
      return result;
    }
  }
  return err(lastError);
}

/**
 * SPEC: DB-LOCK-RECOVERY
 * Forcefully removes SQLite lock artifacts:
 * - .lock directory
 * - -journal file
 * - -wal file
 * - -shm file
 */
export function removeLockFiles(dbPath: string): void {
  const targets = [
    { path: dbPath + LOCK_DIR_SUFFIX, isDir: true },
    { path: dbPath + JOURNAL_SUFFIX, isDir: false },
    { path: dbPath + WAL_SUFFIX, isDir: false },
    { path: dbPath + SHM_SUFFIX, isDir: false },
  ];
  for (const target of targets) {
    if (!fs.existsSync(target.path)) {
      continue;
    }
    try {
      if (target.isDir) {
        fs.rmSync(target.path, { recursive: true });
      } else {
        fs.unlinkSync(target.path);
      }
      logger.info("Removed lock artifact", { path: target.path });
    } catch (e: unknown) {
      logger.error("Failed to remove lock artifact", {
        path: target.path,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Test-only: reset internal state
export function resetForTesting(): void {
  dbHandle = null;
}
