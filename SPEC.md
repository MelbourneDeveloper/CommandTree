# CommandTree Specification

## Table of Contents

- [Overview](#overview)
- [Command Discovery](#command-discovery)
  - [Shell Scripts](#shell-scripts)
  - [NPM Scripts](#npm-scripts)
  - [Makefile Targets](#makefile-targets)
  - [Launch Configurations](#launch-configurations)
  - [VS Code Tasks](#vs-code-tasks)
  - [Python Scripts](#python-scripts)
- [Command Execution](#command-execution)
  - [Run in New Terminal](#run-in-new-terminal)
  - [Run in Current Terminal](#run-in-current-terminal)
  - [Debug](#debug)
- [Quick Launch](#quick-launch)
- [Tagging](#tagging)
  - [Pattern Syntax](#pattern-syntax)
  - [Managing Tags](#managing-tags)
- [Filtering](#filtering)
  - [Text Filter](#text-filter)
  - [Tag Filter](#tag-filter)
  - [Clear Filter](#clear-filter)
- [Parameterized Commands](#parameterized-commands)
- [Settings](#settings)
  - [Exclude Patterns](#exclude-patterns)
  - [Sort Order](#sort-order)
  - [Show Empty Categories](#show-empty-categories)
- [User Data Storage](#user-data-storage)
- [AI Summaries and Semantic Search](#ai-summaries-and-semantic-search)
  - [Summary Generation](#summary-generation)
  - [Embedding Generation](#embedding-generation)
  - [Database Schema](#database-schema)
  - [Search Implementation](#search-implementation)

---

## Overview
**overview**

CommandTree scans a VS Code workspace and surfaces all runnable commands in a single tree view sidebar panel. It discovers shell scripts, npm scripts, Makefile targets, VS Code tasks, launch configurations, etc then presents them in a categorized, filterable tree.

## Command Discovery
**command-discovery**

CommandTree recursively scans the workspace for runnable commands grouped by type. Discovery respects exclude patterns configured in settings. It does this in the background on low priority.

### Shell Scripts
**command-discovery/shell-scripts**

Discovers `.sh` files throughout the workspace. Supports optional `@param` and `@description` comments for metadata.

### NPM Scripts
**command-discovery/npm-scripts**

Reads `scripts` from all `package.json` files, including nested projects and subfolders.

### Makefile Targets
**command-discovery/makefile-targets**

Parses `Makefile` and `makefile` for named targets.

### Launch Configurations
**command-discovery/launch-configurations**

Reads debug configurations from `.vscode/launch.json`.

### VS Code Tasks
**command-discovery/vscode-tasks**

Reads task definitions from `.vscode/tasks.json`, including support for `${input:*}` variable prompts.

### Python Scripts
**command-discovery/python-scripts**

Discovers files with a `.py` extension.

## Command Execution
**command-execution**

Commands can be executed three ways via inline buttons or context menu.

### Run in New Terminal
**command-execution/new-terminal**

Opens a new VS Code terminal and runs the command. Triggered by the play button or `commandtree.run` command.

### Run in Current Terminal
**command-execution/current-terminal**

Sends the command to the currently active terminal. Triggered by the circle-play button or `commandtree.runInCurrentTerminal` command.

### Debug
**command-execution/debug**

Launches the command using the VS Code debugger. Only applicable to launch configurations. Triggered by the bug button or `commandtree.debug` command.

## Quick Launch
**quick-launch**

Users can star commands to pin them in a "Quick Launch" panel at the top of the tree view. Starred command identifiers are persisted in the as `quick` tags in the db.

## Tagging
**tagging**

Tags group related commands for organization and filtering.

### Pattern Syntax
**tagging/pattern-syntax**

| Pattern | Matches |
|---------|---------|
| `npm:build` | Exact match: npm script named "build" |
| `npm:test*` | Wildcard: npm scripts starting with "test" |
| `*deploy*` | Any command with "deploy" in the name |
| `type:shell:*` | All shell scripts |
| `type:npm:*` | All npm scripts |
| `type:make:*` | All Makefile targets |
| `type:launch:*` | All launch configurations |
| `**/scripts/**` | Path matching: commands in any `scripts` folder |
| `shell:/full/path:name` | Exact command identifier (used internally for Quick Launch) |

### Managing Tags
**tagging/management**

- **Add tag to command**: Right-click a command > "Add Tag" > select existing or create new
- **Remove tag from command**: Right-click a command > "Remove Tag"

All tag assignments are stored in the SQLite database (`tags` table).

## Filtering
**filtering**

### Text Filter
**filtering/text**

Free-text filter via toolbar or `commandtree.filter` command. Matches against command names.

### Tag Filter
**filtering/tag**

Pick a tag from the toolbar picker (`commandtree.filterByTag`) to show only commands matching that tag's patterns.

### Clear Filter
**filtering/clear**

Remove all active filters via toolbar button or `commandtree.clearFilter` command.

## Parameterized Commands
**parameterized-commands**

Shell scripts with parameter comments prompt the user for input before execution:

```bash
#!/bin/bash
# @description Deploy to environment
# @param environment Target environment (staging, production)

deploy_to "$1"
```

VS Code tasks using `${input:*}` variables prompt automatically via the built-in input UI.

## Settings
**settings**

All settings are configured via VS Code settings (`Cmd+,` / `Ctrl+,`).

### Exclude Patterns
**settings/exclude-patterns**

`commandtree.excludePatterns` - Glob patterns to exclude from command discovery. Default includes `**/node_modules/**`, `**/.vscode-test/**`, and others.

### Sort Order
**settings/sort-order**

`commandtree.sortOrder` - How commands are sorted within categories:

| Value | Description |
|-------|-------------|
| `folder` | Sort by folder path, then alphabetically (default) |
| `name` | Sort alphabetically by command name |
| `type` | Sort by command type, then alphabetically |

### Show Empty Categories
**settings/show-empty-categories**

`commandtree.showEmptyCategories` - Whether to display category nodes that contain no discovered commands.

---

## User Data Storage
**user-data-storage**

All workspace-specific data is stored in a local SQLite database at `{workspaceFolder}/.commandtree/commandtree.sqlite3`. This includes Quick Launch pins, tag definitions, AI-generated summaries, and embedding vectors.

---

## AI Summaries and Semantic Search
**ai-semantic-search**

GitHub Copilot generates plain-language summaries for each discovered command. Summaries are embedded into 384-dimensional vectors using `all-MiniLM-L6-v2` and stored in SQLite. Users search commands using natural language queries ranked by cosine similarity.

### Summary Generation
**ai-summary-generation**

- **LLM**: GitHub Copilot via `vscode.lm` API (stable since VS Code 1.90)
- **Trigger**: File watch on command files (debounced)
- **Storage**: Markdown in SQLite `{workspaceFolder}/.commandtree/commandtree.sqlite3`
- **Display**: Tooltip on hover, includes ⚠️ warning for security issues
- **Requirement**: GitHub Copilot installed and authenticated

### Embedding Generation
**ai-embedding-generation**

- **Model**: `all-MiniLM-L6-v2` via `@huggingface/transformers`
- **Dimensions**: 384 (Float32)
- **Size**: ~23 MB, downloaded to `{workspaceFolder}/.commandtree/models/`
- **Performance**: ~10ms per embedding
- **Runtime**: Pure JS/WASM, no native binaries
- **Scope**: Embeds summaries and search queries for consistent vector space

### Database Schema
**ai-database-schema**

**Implementation**: SQLite via `node-sqlite3-wasm`
- **Location**: `{workspaceFolder}/.commandtree/commandtree.sqlite3`
- **Runtime**: Pure WASM, no native compilation (~1.3 MB)
- **API**: Synchronous, no async overhead for reads
- **Persistence**: Automatic file-based storage

**Tables**:

```sql
CREATE TABLE IF NOT EXISTS embeddings (
    command_id TEXT PRIMARY KEY,
    content_hash TEXT NOT NULL,
    summary TEXT NOT NULL,
    embedding BLOB,
    last_updated TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
    tag_name TEXT NOT NULL,
    command_pattern TEXT NOT NULL,
    PRIMARY KEY (tag_name, command_pattern)
);
```

**`embeddings` columns**:
- **`command_id`**: Unique command identifier
- **`content_hash`**: SHA-256 hash for change detection
- **`summary`**: Plain-language description (1-3 sentences)
- **`embedding`**: 384 Float32 values (1536 bytes), nullable
- **`last_updated`**: ISO 8601 timestamp

**`tags` columns**:
- **`tag_name`**: Tag identifier (e.g., "quick", "deploy", "test")
- **`command_pattern`**: Pattern matching commands (e.g., "npm:build", "type:shell:*")

### Search Implementation
**ai-search-implementation**

1. User types natural-language query in filter bar (`commandtree.filter`)
2. Query embedded using `all-MiniLM-L6-v2` (~10ms)
3. Results ranked by cosine similarity against stored embeddings
4. Tree view updates with ordered results

**Fallback**: Text-match on summaries if embeddings unavailable, text-match on command names if no summaries exist.
