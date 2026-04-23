/**
 * SPEC: DB-LOCK-RECOVERY
 * Pure filesystem helpers for detecting and clearing SQLite lock artifacts.
 * No VS Code dependency — consumed by both lifecycle.ts and unit tests.
 */

import * as fs from "fs";

const JOURNAL_SUFFIX = "-journal";
const WAL_SUFFIX = "-wal";
const SHM_SUFFIX = "-shm";
const LOCK_DIR_SUFFIX = ".lock";

export interface LockArtifact {
  readonly path: string;
  readonly isDir: boolean;
}

export function isLockError(message: string): boolean {
  return message.includes("locked") || message.includes("SQLITE_BUSY");
}

export function lockArtifactsFor(dbPath: string): readonly LockArtifact[] {
  return [
    { path: dbPath + LOCK_DIR_SUFFIX, isDir: true },
    { path: dbPath + JOURNAL_SUFFIX, isDir: false },
    { path: dbPath + WAL_SUFFIX, isDir: false },
    { path: dbPath + SHM_SUFFIX, isDir: false },
  ];
}

export interface RemoveLockFilesOptions {
  readonly onRemoved?: (artifactPath: string) => void;
  readonly onError?: (artifactPath: string, message: string) => void;
}

/**
 * SPEC: DB-LOCK-RECOVERY
 * Removes SQLite lock artifacts: .lock directory, -journal/-wal/-shm files.
 * Silently continues on missing artifacts. Reports per-artifact outcome via callbacks.
 */
export function removeLockFiles(dbPath: string, options: RemoveLockFilesOptions = {}): void {
  for (const target of lockArtifactsFor(dbPath)) {
    if (!fs.existsSync(target.path)) {
      continue;
    }
    try {
      if (target.isDir) {
        fs.rmSync(target.path, { recursive: true });
      } else {
        fs.unlinkSync(target.path);
      }
      options.onRemoved?.(target.path);
    } catch (e: unknown) {
      options.onError?.(target.path, e instanceof Error ? e.message : String(e));
    }
  }
}
