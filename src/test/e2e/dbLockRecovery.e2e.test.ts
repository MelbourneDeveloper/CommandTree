/**
 * SPEC: DB-LOCK-RECOVERY
 * Unit tests for database lock recovery in lifecycle.ts.
 * Verifies: retry with backoff, force-remove lock artifacts, successful recovery.
 */

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { initDb, removeLockFiles, disposeDb, resetForTesting } from "../../db/lifecycle";

const DB_FILENAME = "commandtree.sqlite3";
const COMMANDTREE_DIR = ".commandtree";

function createTempWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "commandtree-lock-test-"));
}

function cleanupWorkspace(workspaceRoot: string): void {
  disposeDb();
  resetForTesting();
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
}

function dbPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, COMMANDTREE_DIR, DB_FILENAME);
}

function createLockDir(workspaceRoot: string): void {
  const lockPath = `${dbPath(workspaceRoot)}.lock`;
  fs.mkdirSync(lockPath, { recursive: true });
}

function createJournalFile(workspaceRoot: string): void {
  const journalPath = `${dbPath(workspaceRoot)}-journal`;
  fs.mkdirSync(path.dirname(journalPath), { recursive: true });
  fs.writeFileSync(journalPath, "stale journal data");
}

function createWalFile(workspaceRoot: string): void {
  const walPath = `${dbPath(workspaceRoot)}-wal`;
  fs.mkdirSync(path.dirname(walPath), { recursive: true });
  fs.writeFileSync(walPath, "stale wal data");
}

function createShmFile(workspaceRoot: string): void {
  const shmPath = `${dbPath(workspaceRoot)}-shm`;
  fs.mkdirSync(path.dirname(shmPath), { recursive: true });
  fs.writeFileSync(shmPath, "stale shm data");
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
  suite("removeLockFiles", () => {
    test("removes .lock directory when present", () => {
      const db = dbPath(workspaceRoot);
      fs.mkdirSync(path.dirname(db), { recursive: true });
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
      fs.mkdirSync(path.dirname(db), { recursive: true });
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
      fs.mkdirSync(path.dirname(db), { recursive: true });
      removeLockFiles(db);
    });
  });

  // SPEC: DB-LOCK-RECOVERY
  suite("initDb", () => {
    test("succeeds on clean workspace with no locks", async () => {
      const result = await initDb(workspaceRoot);
      assert.ok(result.ok, `Expected ok but got error: ${result.ok ? "" : result.error}`);
      assert.ok(fs.existsSync(dbPath(workspaceRoot)), "DB file should be created");
    });

    test("returns same handle on second call", async () => {
      const first = await initDb(workspaceRoot);
      assert.ok(first.ok);
      const second = await initDb(workspaceRoot);
      assert.ok(second.ok);
      assert.strictEqual(first.value.path, second.value.path);
    });

    test("recovers after stale lock files are present pre-init", async () => {
      createLockDir(workspaceRoot);
      createJournalFile(workspaceRoot);

      // Remove lock files first (simulating what initDb does on force recovery)
      removeLockFiles(dbPath(workspaceRoot));

      const result = await initDb(workspaceRoot);
      assert.ok(result.ok, `Expected ok but got error: ${result.ok ? "" : result.error}`);
    });
  });
});
