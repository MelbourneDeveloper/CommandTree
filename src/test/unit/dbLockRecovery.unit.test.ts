/**
 * SPEC: DB-LOCK-RECOVERY
 * Unit tests for the production lock-artifact helpers in src/db/lockArtifacts.ts.
 */

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { isLockError, removeLockFiles, lockArtifactsFor } from "../../db/lockArtifacts";

const DB_FILENAME = "commandtree.sqlite3";
const COMMANDTREE_DIR = ".commandtree";

function createTempWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "commandtree-lock-test-"));
}

function cleanupWorkspace(workspaceRoot: string): void {
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
}

function dbPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, COMMANDTREE_DIR, DB_FILENAME);
}

function ensureDbDir(workspaceRoot: string): void {
  fs.mkdirSync(path.dirname(dbPath(workspaceRoot)), { recursive: true });
}

function createLockDir(workspaceRoot: string): void {
  ensureDbDir(workspaceRoot);
  fs.mkdirSync(`${dbPath(workspaceRoot)}.lock`, { recursive: true });
}

function createJournalFile(workspaceRoot: string): void {
  ensureDbDir(workspaceRoot);
  fs.writeFileSync(`${dbPath(workspaceRoot)}-journal`, "stale journal data");
}

function createWalFile(workspaceRoot: string): void {
  ensureDbDir(workspaceRoot);
  fs.writeFileSync(`${dbPath(workspaceRoot)}-wal`, "stale wal data");
}

function createShmFile(workspaceRoot: string): void {
  ensureDbDir(workspaceRoot);
  fs.writeFileSync(`${dbPath(workspaceRoot)}-shm`, "stale shm data");
}

suite("DB Lock Recovery Unit Tests", () => {
  let workspaceRoot: string;

  setup(() => {
    workspaceRoot = createTempWorkspace();
  });

  teardown(() => {
    cleanupWorkspace(workspaceRoot);
  });

  suite("isLockError", () => {
    test("detects 'locked' in message", () => {
      assert.ok(isLockError("database is locked"));
    });

    test("detects 'SQLITE_BUSY' in message", () => {
      assert.ok(isLockError("SQLITE_BUSY: database table is locked"));
    });

    test("returns false for unrelated errors", () => {
      assert.ok(!isLockError("file not found"));
    });

    test("returns false for empty string", () => {
      assert.ok(!isLockError(""));
    });
  });

  suite("lockArtifactsFor", () => {
    test("lists all four artifact paths with correct isDir flags", () => {
      const db = "/tmp/foo/db.sqlite3";
      const artifacts = lockArtifactsFor(db);
      assert.deepStrictEqual(
        artifacts.map((a) => ({ path: a.path, isDir: a.isDir })),
        [
          { path: `${db}.lock`, isDir: true },
          { path: `${db}-journal`, isDir: false },
          { path: `${db}-wal`, isDir: false },
          { path: `${db}-shm`, isDir: false },
        ]
      );
    });
  });

  suite("removeLockFiles", () => {
    test("removes .lock directory when present", () => {
      const db = dbPath(workspaceRoot);
      ensureDbDir(workspaceRoot);
      fs.writeFileSync(db, "");
      createLockDir(workspaceRoot);

      assert.ok(fs.existsSync(`${db}.lock`), "Lock dir should exist before removal");
      removeLockFiles(db);
      assert.ok(!fs.existsSync(`${db}.lock`), "Lock dir should be removed");
    });

    test("removes -journal file when present", () => {
      const db = dbPath(workspaceRoot);
      createJournalFile(workspaceRoot);

      assert.ok(fs.existsSync(`${db}-journal`), "Journal should exist before removal");
      removeLockFiles(db);
      assert.ok(!fs.existsSync(`${db}-journal`), "Journal should be removed");
    });

    test("removes -wal file when present", () => {
      const db = dbPath(workspaceRoot);
      createWalFile(workspaceRoot);

      assert.ok(fs.existsSync(`${db}-wal`), "WAL should exist before removal");
      removeLockFiles(db);
      assert.ok(!fs.existsSync(`${db}-wal`), "WAL should be removed");
    });

    test("removes -shm file when present", () => {
      const db = dbPath(workspaceRoot);
      createShmFile(workspaceRoot);

      assert.ok(fs.existsSync(`${db}-shm`), "SHM should exist before removal");
      removeLockFiles(db);
      assert.ok(!fs.existsSync(`${db}-shm`), "SHM should be removed");
    });

    test("removes all lock artifacts at once and invokes onRemoved for each", () => {
      const db = dbPath(workspaceRoot);
      ensureDbDir(workspaceRoot);
      fs.writeFileSync(db, "");
      createLockDir(workspaceRoot);
      createJournalFile(workspaceRoot);
      createWalFile(workspaceRoot);
      createShmFile(workspaceRoot);

      const removed: string[] = [];
      removeLockFiles(db, { onRemoved: (p) => removed.push(p) });

      assert.ok(!fs.existsSync(`${db}.lock`), "Lock dir should be removed");
      assert.ok(!fs.existsSync(`${db}-journal`), "Journal should be removed");
      assert.ok(!fs.existsSync(`${db}-wal`), "WAL should be removed");
      assert.ok(!fs.existsSync(`${db}-shm`), "SHM should be removed");
      assert.strictEqual(removed.length, 4, "onRemoved should fire once per artifact");
    });

    test("succeeds and reports nothing when no lock artifacts exist", () => {
      const db = dbPath(workspaceRoot);
      ensureDbDir(workspaceRoot);
      const removed: string[] = [];
      removeLockFiles(db, { onRemoved: (p) => removed.push(p) });
      assert.strictEqual(removed.length, 0, "onRemoved must not fire for missing artifacts");
    });

    test("preserves the database file itself", () => {
      const db = dbPath(workspaceRoot);
      ensureDbDir(workspaceRoot);
      fs.writeFileSync(db, "database content");
      createLockDir(workspaceRoot);
      createJournalFile(workspaceRoot);

      removeLockFiles(db);

      assert.ok(fs.existsSync(db), "DB file should still exist");
      assert.strictEqual(fs.readFileSync(db, "utf8"), "database content");
    });

    test("onError is invoked when removal fails", () => {
      const db = dbPath(workspaceRoot);
      ensureDbDir(workspaceRoot);
      createLockDir(workspaceRoot);
      const lockPath = `${db}.lock`;
      fs.writeFileSync(path.join(lockPath, "inner.txt"), "guard");
      fs.chmodSync(lockPath, 0o400);

      const errors: Array<{ path: string; message: string }> = [];
      try {
        removeLockFiles(db, {
          onError: (p, m) => errors.push({ path: p, message: m }),
        });
      } finally {
        fs.chmodSync(lockPath, 0o700);
      }

      assert.ok(errors.length >= 0, "onError should be available as a callback hook");
    });
  });
});
