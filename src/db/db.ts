/**
 * SPEC: database-schema, database-schema/tags-table, database-schema/command-tags-junction, database-schema/tag-operations
 * SQLite storage layer for commands, tags, and AI summaries.
 * Uses node-sqlite3-wasm for WASM-based SQLite.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import type { Result } from "../models/Result";
import { ok, err } from "../models/Result";
import { logger } from "../utils/logger";

import sqlite3 from "node-sqlite3-wasm";
import type { Database as SqliteDatabase } from "node-sqlite3-wasm";

const COMMAND_TABLE = "commands";
const TAG_TABLE = "tags";
const COMMAND_TAGS_TABLE = "command_tags";

export interface DbHandle {
  readonly db: SqliteDatabase;
  readonly path: string;
}

/**
 * Opens a SQLite database at the given path.
 * Enables foreign key constraints on every connection.
 */
export function openDatabase(dbPath: string): Result<DbHandle, string> {
  try {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const db = new sqlite3.Database(dbPath);
    db.exec("PRAGMA foreign_keys = ON");
    return ok({ db, path: dbPath });
  } catch (e) {
    const msg = (e as Error).message;
    logger.error("openDatabase FAILED", { dbPath, error: msg });
    return err(msg);
  }
}

/**
 * Closes a database connection.
 */
export function closeDatabase(handle: DbHandle): void {
  handle.db.close();
}

export interface CommandRow {
  readonly commandId: string;
  readonly contentHash: string;
  readonly summary: string;
  readonly securityWarning: string | null;
  readonly lastUpdated: string;
}

/**
 * Computes a content hash for change detection.
 */
export function computeContentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").substring(0, 16);
}

function addColumnIfMissing(params: {
  readonly handle: DbHandle;
  readonly table: string;
  readonly column: string;
  readonly definition: string;
}): void {
  try {
    params.handle.db.exec(`ALTER TABLE ${params.table} ADD COLUMN ${params.column} ${params.definition}`);
  } catch {
    // Column already exists — expected for existing databases
  }
}

/**
 * SPEC: database-schema, database-schema/tags-table, database-schema/command-tags-junction
 * Creates the commands, tags, and command_tags tables if they do not exist.
 */
export function initSchema(handle: DbHandle): void {
  handle.db.exec(`
            CREATE TABLE IF NOT EXISTS ${COMMAND_TABLE} (
                command_id TEXT PRIMARY KEY,
                content_hash TEXT NOT NULL DEFAULT '',
                summary TEXT NOT NULL DEFAULT '',
                security_warning TEXT,
                last_updated TEXT NOT NULL DEFAULT ''
            )
        `);
  addColumnIfMissing({
    handle,
    table: COMMAND_TABLE,
    column: "content_hash",
    definition: "TEXT NOT NULL DEFAULT ''",
  });
  addColumnIfMissing({ handle, table: COMMAND_TABLE, column: "summary", definition: "TEXT NOT NULL DEFAULT ''" });
  addColumnIfMissing({ handle, table: COMMAND_TABLE, column: "security_warning", definition: "TEXT" });
  addColumnIfMissing({
    handle,
    table: COMMAND_TABLE,
    column: "last_updated",
    definition: "TEXT NOT NULL DEFAULT ''",
  });
  handle.db.exec(`
            CREATE TABLE IF NOT EXISTS ${TAG_TABLE} (
                tag_id TEXT PRIMARY KEY,
                tag_name TEXT NOT NULL UNIQUE,
                description TEXT
            )
        `);
  handle.db.exec(`
            CREATE TABLE IF NOT EXISTS ${COMMAND_TAGS_TABLE} (
                command_id TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                display_order INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (command_id, tag_id),
                FOREIGN KEY (command_id) REFERENCES ${COMMAND_TABLE}(command_id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES ${TAG_TABLE}(tag_id) ON DELETE CASCADE
            )
        `);
}

type RawRow = Record<string, number | bigint | string | Uint8Array | null>;

/**
 * Registers a discovered command in the DB with its content hash.
 * Inserts with empty summary if new; updates only content_hash if existing.
 */
export function registerCommand(params: {
  readonly handle: DbHandle;
  readonly commandId: string;
  readonly contentHash: string;
}): void {
  const now = new Date().toISOString();
  params.handle.db.run(
    `INSERT INTO ${COMMAND_TABLE}
             (command_id, content_hash, summary, security_warning, last_updated)
             VALUES (?, ?, '', NULL, ?)
             ON CONFLICT(command_id) DO UPDATE SET
               content_hash = excluded.content_hash,
               last_updated = excluded.last_updated`,
    [params.commandId, params.contentHash, now]
  );
}

/**
 * Ensures a command record exists for referential integrity.
 */
export function ensureCommandExists(params: { readonly handle: DbHandle; readonly commandId: string }): void {
  registerCommand({
    handle: params.handle,
    commandId: params.commandId,
    contentHash: "",
  });
}

/**
 * Upserts ONLY the summary and content hash for a command.
 * Used by the summary pipeline.
 */
export function upsertSummary(params: {
  readonly handle: DbHandle;
  readonly commandId: string;
  readonly contentHash: string;
  readonly summary: string;
  readonly securityWarning: string | null;
}): void {
  const now = new Date().toISOString();
  params.handle.db.run(
    `INSERT INTO ${COMMAND_TABLE}
             (command_id, content_hash, summary, security_warning, last_updated)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(command_id) DO UPDATE SET
               content_hash = excluded.content_hash,
               summary = excluded.summary,
               security_warning = excluded.security_warning,
               last_updated = excluded.last_updated`,
    [params.commandId, params.contentHash, params.summary, params.securityWarning, now]
  );
}

/**
 * Gets a single command record by command ID.
 */
export function getRow(params: { readonly handle: DbHandle; readonly commandId: string }): CommandRow | undefined {
  const row = params.handle.db.get(`SELECT * FROM ${COMMAND_TABLE} WHERE command_id = ?`, [params.commandId]);
  if (row === null) {
    return undefined;
  }
  return rawToCommandRow(row as RawRow);
}

/**
 * Gets all command records from the database.
 */
export function getAllRows(handle: DbHandle): CommandRow[] {
  const rows = handle.db.all(`SELECT * FROM ${COMMAND_TABLE}`);
  return rows.map((r) => rawToCommandRow(r as RawRow));
}

function rawToCommandRow(row: RawRow): CommandRow {
  return {
    commandId: row["command_id"] as string,
    contentHash: row["content_hash"] as string,
    summary: row["summary"] as string,
    securityWarning: row["security_warning"] as string | null,
    lastUpdated: row["last_updated"] as string,
  };
}

/**
 * SPEC: database-schema/tag-operations, tagging, tagging/management
 * Adds a tag to a command with optional display order.
 * Ensures both tag and command exist before creating junction record.
 */
export function addTagToCommand(params: {
  readonly handle: DbHandle;
  readonly commandId: string;
  readonly tagName: string;
  readonly displayOrder?: number;
}): void {
  ensureCommandExists({
    handle: params.handle,
    commandId: params.commandId,
  });
  const existing = params.handle.db.get(`SELECT tag_id FROM ${TAG_TABLE} WHERE tag_name = ?`, [params.tagName]);
  const tagId = existing !== null ? ((existing as RawRow)["tag_id"] as string) : crypto.randomUUID();
  if (existing === null) {
    params.handle.db.run(`INSERT INTO ${TAG_TABLE} (tag_id, tag_name, description) VALUES (?, ?, NULL)`, [
      tagId,
      params.tagName,
    ]);
  }
  const order = params.displayOrder ?? 0;
  params.handle.db.run(
    `INSERT OR IGNORE INTO ${COMMAND_TAGS_TABLE} (command_id, tag_id, display_order) VALUES (?, ?, ?)`,
    [params.commandId, tagId, order]
  );
}

/**
 * SPEC: database-schema/tag-operations, tagging, tagging/management
 * Removes a tag from a command.
 */
export function removeTagFromCommand(params: {
  readonly handle: DbHandle;
  readonly commandId: string;
  readonly tagName: string;
}): void {
  params.handle.db.run(
    `DELETE FROM ${COMMAND_TAGS_TABLE}
             WHERE command_id = ?
             AND tag_id = (SELECT tag_id FROM ${TAG_TABLE} WHERE tag_name = ?)`,
    [params.commandId, params.tagName]
  );
}

/**
 * SPEC: database-schema/tag-operations, tagging/filter
 * Gets all command IDs for a given tag, ordered by display_order.
 */
export function getCommandIdsByTag(params: { readonly handle: DbHandle; readonly tagName: string }): string[] {
  const rows = params.handle.db.all(
    `SELECT ct.command_id
             FROM ${COMMAND_TAGS_TABLE} ct
             JOIN ${TAG_TABLE} t ON ct.tag_id = t.tag_id
             WHERE t.tag_name = ?
             ORDER BY ct.display_order`,
    [params.tagName]
  );
  return rows.map((r) => (r as RawRow)["command_id"] as string);
}

/**
 * SPEC: database-schema/tag-operations, tagging
 * Gets all tags for a given command.
 */
export function getTagsForCommand(params: { readonly handle: DbHandle; readonly commandId: string }): string[] {
  const rows = params.handle.db.all(
    `SELECT t.tag_name
             FROM ${TAG_TABLE} t
             JOIN ${COMMAND_TAGS_TABLE} ct ON t.tag_id = ct.tag_id
             WHERE ct.command_id = ?`,
    [params.commandId]
  );
  return rows.map((r) => (r as RawRow)["tag_name"] as string);
}

/**
 * SPEC: database-schema/tag-operations, tagging/filter
 * Gets all distinct tag names.
 */
export function getAllTagNames(handle: DbHandle): string[] {
  const rows = handle.db.all(`SELECT tag_name FROM ${TAG_TABLE} ORDER BY tag_name`);
  return rows.map((r) => (r as RawRow)["tag_name"] as string);
}

/**
 * SPEC: database-schema/tag-operations, quick-launch
 * Updates the display order for a tag assignment.
 */
export function updateTagDisplayOrder(params: {
  readonly handle: DbHandle;
  readonly commandId: string;
  readonly tagId: string;
  readonly newOrder: number;
}): void {
  params.handle.db.run(`UPDATE ${COMMAND_TAGS_TABLE} SET display_order = ? WHERE command_id = ? AND tag_id = ?`, [
    params.newOrder,
    params.commandId,
    params.tagId,
  ]);
}

/**
 * SPEC: quick-launch
 * Reorders command IDs for a tag by updating display_order.
 */
export function reorderTagCommands(params: {
  readonly handle: DbHandle;
  readonly tagName: string;
  readonly orderedCommandIds: readonly string[];
}): void {
  const tagRow = params.handle.db.get(`SELECT tag_id FROM ${TAG_TABLE} WHERE tag_name = ?`, [params.tagName]);
  if (tagRow === null) {
    return;
  }
  const tagId = (tagRow as RawRow)["tag_id"] as string;
  params.orderedCommandIds.forEach((commandId, index) => {
    params.handle.db.run(`UPDATE ${COMMAND_TAGS_TABLE} SET display_order = ? WHERE command_id = ? AND tag_id = ?`, [
      index,
      commandId,
      tagId,
    ]);
  });
}
