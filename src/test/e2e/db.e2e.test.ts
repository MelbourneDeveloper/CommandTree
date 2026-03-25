import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import {
  openDatabase,
  closeDatabase,
  initSchema,
  registerCommand,
  getRow,
  addTagToCommand,
  removeTagFromCommand,
  getCommandIdsByTag,
  getAllTagNames,
  computeContentHash,
} from "../../db/db";
import type { DbHandle } from "../../db/db";

/**
 * Unit tests for db.ts — error handling, edge cases, column migration.
 */
suite("DB Unit Tests", () => {
  let handle: DbHandle;
  let dbPath: string;

  setup(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "commandtree-db-test-"));
    dbPath = path.join(tmpDir, "test.sqlite3");
    const openResult = openDatabase(dbPath);
    assert.ok(openResult.ok, "Failed to open database");
    handle = openResult.value;
    const schemaResult = initSchema(handle);
    assert.ok(schemaResult.ok, "Failed to init schema");
  });

  teardown(() => {
    closeDatabase(handle);
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    const dir = path.dirname(dbPath);
    if (fs.existsSync(dir)) {
      fs.rmdirSync(dir);
    }
  });

  suite("addColumnIfMissing", () => {
    test("initSchema is idempotent — calling twice succeeds", () => {
      const result = initSchema(handle);
      assert.ok(result.ok, "Second initSchema call should succeed");
    });
  });

  suite("registerCommand", () => {
    test("inserts new command", () => {
      const result = registerCommand({
        handle,
        commandId: "test-cmd-1",
        contentHash: "hash1",
      });
      assert.ok(result.ok);

      const row = getRow({ handle, commandId: "test-cmd-1" });
      assert.ok(row.ok);
      assert.ok(row.value !== undefined);
      assert.strictEqual(row.value.commandId, "test-cmd-1");
      assert.strictEqual(row.value.contentHash, "hash1");
    });

    test("upsert updates content hash on conflict", () => {
      registerCommand({ handle, commandId: "test-cmd-2", contentHash: "hash-old" });
      registerCommand({ handle, commandId: "test-cmd-2", contentHash: "hash-new" });

      const row = getRow({ handle, commandId: "test-cmd-2" });
      assert.ok(row.ok);
      assert.ok(row.value !== undefined);
      assert.strictEqual(row.value.contentHash, "hash-new");
    });
  });

  suite("getRow", () => {
    test("returns undefined for non-existent command", () => {
      const result = getRow({ handle, commandId: "nonexistent" });
      assert.ok(result.ok);
      assert.strictEqual(result.value, undefined);
    });
  });

  suite("tag operations", () => {
    test("addTagToCommand creates tag and junction record", () => {
      registerCommand({ handle, commandId: "cmd-tag-1", contentHash: "h1" });
      const result = addTagToCommand({
        handle,
        commandId: "cmd-tag-1",
        tagName: "build",
      });
      assert.ok(result.ok);

      const ids = getCommandIdsByTag({ handle, tagName: "build" });
      assert.ok(ids.ok);
      assert.ok(ids.value.length > 0);
      assert.ok(ids.value.includes("cmd-tag-1"));
    });

    test("addTagToCommand is idempotent", () => {
      registerCommand({ handle, commandId: "cmd-tag-2", contentHash: "h2" });
      addTagToCommand({ handle, commandId: "cmd-tag-2", tagName: "deploy" });
      const result = addTagToCommand({ handle, commandId: "cmd-tag-2", tagName: "deploy" });
      assert.ok(result.ok);

      const ids = getCommandIdsByTag({ handle, tagName: "deploy" });
      assert.ok(ids.ok);
      assert.strictEqual(ids.value.filter((id) => id === "cmd-tag-2").length, 1);
    });

    test("removeTagFromCommand removes junction record", () => {
      registerCommand({ handle, commandId: "cmd-tag-3", contentHash: "h3" });
      addTagToCommand({ handle, commandId: "cmd-tag-3", tagName: "test" });
      const removeResult = removeTagFromCommand({
        handle,
        commandId: "cmd-tag-3",
        tagName: "test",
      });
      assert.ok(removeResult.ok);

      const ids = getCommandIdsByTag({ handle, tagName: "test" });
      assert.ok(ids.ok);
      assert.ok(!ids.value.includes("cmd-tag-3"));
    });

    test("removeTagFromCommand succeeds for non-existent tag", () => {
      registerCommand({ handle, commandId: "cmd-tag-4", contentHash: "h4" });
      const result = removeTagFromCommand({
        handle,
        commandId: "cmd-tag-4",
        tagName: "nonexistent",
      });
      assert.ok(result.ok);
    });

    test("getAllTagNames returns all distinct tags", () => {
      registerCommand({ handle, commandId: "cmd-tags-5", contentHash: "h5" });
      addTagToCommand({ handle, commandId: "cmd-tags-5", tagName: "alpha" });
      addTagToCommand({ handle, commandId: "cmd-tags-5", tagName: "beta" });

      const result = getAllTagNames(handle);
      assert.ok(result.ok);
      assert.ok(result.value.includes("alpha"));
      assert.ok(result.value.includes("beta"));
    });
  });

  suite("computeContentHash", () => {
    test("returns consistent hash for same input", () => {
      const hash1 = computeContentHash("echo hello");
      const hash2 = computeContentHash("echo hello");
      assert.strictEqual(hash1, hash2);
    });

    test("returns different hash for different input", () => {
      const hash1 = computeContentHash("echo hello");
      const hash2 = computeContentHash("echo world");
      assert.notStrictEqual(hash1, hash2);
    });

    test("returns 16-char hex string", () => {
      const hash = computeContentHash("test");
      assert.strictEqual(hash.length, 16);
    });
  });
});
