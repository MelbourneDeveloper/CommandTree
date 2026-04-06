# Database Schema

**SPEC-DB-001**

Three tables store AI summaries, tag definitions, and tag assignments.

```sql
CREATE TABLE IF NOT EXISTS commands (
    command_id TEXT PRIMARY KEY,
    content_hash TEXT NOT NULL,
    summary TEXT NOT NULL,
    security_warning TEXT,
    last_updated TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
    tag_id TEXT PRIMARY KEY,
    tag_name TEXT NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS command_tags (
    command_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (command_id, tag_id),
    FOREIGN KEY (command_id) REFERENCES commands(command_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(tag_id) ON DELETE CASCADE
);
```

CRITICAL: No backwards compatibility. If the database structure is wrong, the extension blows it away and recreates it from scratch.

## Implementation

**SPEC-DB-010**

- **Engine**: SQLite via `node-sqlite3-wasm`
- **Location**: `{workspaceFolder}/.commandtree/commandtree.sqlite3`
- **Runtime**: Pure WASM, no native compilation (~1.3 MB)
- **CRITICAL**: `PRAGMA foreign_keys = ON;` MUST be executed on EVERY database connection
- **Orphan Prevention**: `ensureCommandExists()` inserts placeholder command rows before adding tags
- **API**: Synchronous, no async overhead for reads

### Test Coverage
- [db.e2e.test.ts](../src/test/e2e/db.e2e.test.ts): "initSchema is idempotent — calling twice succeeds"

## Commands Table

**SPEC-DB-020**

- **`command_id`**: `{type}:{filePath}:{name}` (PRIMARY KEY)
- **`content_hash`**: SHA-256 hash for change detection (NOT NULL)
- **`summary`**: AI-generated description, 1-3 sentences (NOT NULL)
- **`security_warning`**: AI-detected security risk (nullable)
- **`last_updated`**: ISO 8601 timestamp (NOT NULL)

### Test Coverage
- [db.e2e.test.ts](../src/test/e2e/db.e2e.test.ts): "inserts new command", "upsert updates content hash on conflict", "returns undefined for non-existent command"

## Tags Table

**SPEC-DB-030**

- **`tag_id`**: UUID primary key
- **`tag_name`**: Tag identifier, UNIQUE (NOT NULL)
- **`description`**: Optional description (nullable)

### Test Coverage
- [db.e2e.test.ts](../src/test/e2e/db.e2e.test.ts): "addTagToCommand creates tag and junction record", "getAllTagNames returns all distinct tags"

## Command Tags Junction Table

**SPEC-DB-040**

- **`command_id`**: FK to `commands.command_id` with CASCADE DELETE
- **`tag_id`**: FK to `tags.tag_id` with CASCADE DELETE
- **`display_order`**: Integer for ordering (default 0)
- **Primary Key**: `(command_id, tag_id)`

### Test Coverage
- [db.e2e.test.ts](../src/test/e2e/db.e2e.test.ts): "addTagToCommand creates tag and junction record", "addTagToCommand is idempotent", "removeTagFromCommand removes junction record", "removeTagFromCommand succeeds for non-existent tag"

## Content Hashing

**SPEC-DB-050**

Content hashing is used for change detection to avoid re-processing unchanged commands.

### Test Coverage
- [db.e2e.test.ts](../src/test/e2e/db.e2e.test.ts): "returns consistent hash for same input", "returns different hash for different input", "returns 16-char hex string"
