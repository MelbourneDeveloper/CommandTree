/**
 * SPEC: database-schema, DB-LOCK-RECOVERY
 * Lifecycle management for the database. State lives in appState.
 */

import * as fs from "fs";
import * as path from "path";
import { logger } from "../utils/logger";
import type { DbHandle } from "./db";
import { openDatabase, initSchema, closeDatabase } from "./db";
import type { Result } from "../models/Result";
import { ok, err } from "../models/Result";
import { isLockError, removeLockFiles as removeLockFilesPure } from "./lockArtifacts";
import { appState } from "../state";

const COMMANDTREE_DIR = ".commandtree";
const DB_FILENAME = "commandtree.sqlite3";
const LOCK_RETRY_INTERVAL_MS = 1000;
const LOCK_RETRY_MAX_MS = 10000;

/**
 * SPEC: DB-LOCK-RECOVERY
 * Initialises the SQLite database.
 * If the database is locked, retries for 10 seconds then
 * forcefully removes lock/journal files and retries.
 */
export async function initDb(workspaceRoot: string): Promise<Result<DbHandle, string>> {
  if (appState.dbHandle !== null && fs.existsSync(appState.dbHandle.path)) {
    return ok(appState.dbHandle);
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
  if (appState.dbHandle !== null && fs.existsSync(appState.dbHandle.path)) {
    return ok(appState.dbHandle);
  }
  resetStaleHandle();
  return err("Database not initialised. Call initDb first.");
}

/**
 * Returns the database handle, throwing if not initialised.
 * Use in code paths where the DB is guaranteed to be available.
 */
export function getDbOrThrow(): DbHandle {
  const result = getDb();
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

function resetStaleHandle(): void {
  if (appState.dbHandle !== null) {
    closeDatabase(appState.dbHandle);
    appState.dbHandle = null;
  }
}

/**
 * Disposes the database connection.
 */
export function disposeDb(): void {
  const currentDb = appState.dbHandle;
  appState.dbHandle = null;
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
  appState.dbHandle = openResult.value;
  logger.info("SQLite database initialised", { path: dbPath });
  return ok(openResult.value);
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
 * Forcefully removes SQLite lock artifacts. Logging wrapper around the pure helper.
 */
export function removeLockFiles(dbPath: string): void {
  removeLockFilesPure(dbPath, {
    onRemoved: (artifactPath) => logger.info("Removed lock artifact", { path: artifactPath }),
    onError: (artifactPath, message) =>
      logger.error("Failed to remove lock artifact", { path: artifactPath, error: message }),
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Test-only: reset internal state
export function resetForTesting(): void {
  appState.dbHandle = null;
}
