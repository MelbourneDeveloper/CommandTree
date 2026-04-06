/**
 * SPEC: DB-LOCK-RECOVERY
 * Unit tests for database lock file removal.
 * Tests the pure filesystem operations that don't require vscode.
 */

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

/**
 * Replicated from lifecycle.ts to avoid vscode dependency in unit tests.
 * The actual removeLockFiles function lives in src/db/lifecycle.ts.
 */
function removeLockFiles(targetDbPath: string): void {
  const targets = [
    { path: `${targetDbPath}.lock`, isDir: true },
    { path: `${targetDbPath}-journal`, isDir: false },
    { path: `${targetDbPath}-wal`, isDir: false },
    { path: `${targetDbPath}-shm`, isDir: false },
  ];
  for (const target of targets) {
    if (!fs.existsSync(target.path)) {
      continue;
    }
    if (target.isDir) {
      fs.rmSync(target.path, { recursive: true });
    } else {
      fs.unlinkSync(target.path);
    }
  }
}

function isLockError(message: string): boolean {
  return message.includes("locked") || message.includes("SQLITE_BUSY");
}

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

  // SPEC: DB-LOCK-RECOVERY
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

  // SPEC: DB-LOCK-RECOVERY
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

    test("removes all lock artifacts at once", () => {
      const db = dbPath(workspaceRoot);
      ensureDbDir(workspaceRoot);
      fs.writeFileSync(db, "");
      createLockDir(workspaceRoot);
      createJournalFile(workspaceRoot);
      createWalFile(workspaceRoot);
      createShmFile(workspaceRoot);

      removeLockFiles(db);

      assert.ok(!fs.existsSync(`${db}.lock`), "Lock dir should be removed");
      assert.ok(!fs.existsSync(`${db}-journal`), "Journal should be removed");
      assert.ok(!fs.existsSync(`${db}-wal`), "WAL should be removed");
      assert.ok(!fs.existsSync(`${db}-shm`), "SHM should be removed");
    });

    test("succeeds when no lock artifacts exist", () => {
      const db = dbPath(workspaceRoot);
      ensureDbDir(workspaceRoot);
      removeLockFiles(db);
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
  });
});
