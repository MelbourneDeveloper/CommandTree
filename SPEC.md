# TaskTree Specification

## Table of Contents

- [S-001: Overview](#s-001-overview)
- [S-002: Task Discovery](#s-002-task-discovery)
  - [S-002a: Shell Scripts](#s-002a-shell-scripts)
  - [S-002b: NPM Scripts](#s-002b-npm-scripts)
  - [S-002c: Makefile Targets](#s-002c-makefile-targets)
  - [S-002d: Launch Configurations](#s-002d-launch-configurations)
  - [S-002e: VS Code Tasks](#s-002e-vs-code-tasks)
  - [S-002f: Python Scripts](#s-002f-python-scripts)
- [S-003: Task Execution](#s-003-task-execution)
  - [S-003a: Run in New Terminal](#s-003a-run-in-new-terminal)
  - [S-003b: Run in Current Terminal](#s-003b-run-in-current-terminal)
  - [S-003c: Debug](#s-003c-debug)
- [S-004: Quick Tasks](#s-004-quick-tasks)
- [S-005: Tagging](#s-005-tagging)
  - [S-005a: Tag Configuration File](#s-005a-tag-configuration-file)
  - [S-005b: Pattern Syntax](#s-005b-pattern-syntax)
  - [S-005c: Managing Tags](#s-005c-managing-tags)
- [S-006: Filtering](#s-006-filtering)
  - [S-006a: Text Filter](#s-006a-text-filter)
  - [S-006b: Tag Filter](#s-006b-tag-filter)
  - [S-006c: Clear Filter](#s-006c-clear-filter)
- [S-007: Parameterized Tasks](#s-007-parameterized-tasks)
- [S-008: Settings](#s-008-settings)
  - [S-008a: Exclude Patterns](#s-008a-exclude-patterns)
  - [S-008b: Sort Order](#s-008b-sort-order)
  - [S-008c: Show Empty Categories](#s-008c-show-empty-categories)
- [S-009: User Data Storage](#s-009-user-data-storage)

---

## S-001: Overview

TaskTree scans a VS Code workspace and surfaces all runnable tasks in a single tree view sidebar panel. It discovers shell scripts, npm scripts, Makefile targets, VS Code tasks, and launch configurations, then presents them in a categorized, filterable tree.

## S-002: Task Discovery

TaskTree recursively scans the workspace for runnable tasks grouped by type. Discovery respects exclude patterns configured in settings.

### S-002a: Shell Scripts

Discovers `.sh` files throughout the workspace. Supports optional `@param` and `@description` comments for metadata.

### S-002b: NPM Scripts

Reads `scripts` from all `package.json` files, including nested projects and subfolders.

### S-002c: Makefile Targets

Parses `Makefile` and `makefile` for named targets.

### S-002d: Launch Configurations

Reads debug configurations from `.vscode/launch.json`.

### S-002e: VS Code Tasks

Reads task definitions from `.vscode/tasks.json`, including support for `${input:*}` variable prompts.

### S-002f: Python Scripts

Discovers files with a `.py` extension.

## S-003: Task Execution

Tasks can be executed three ways via inline buttons or context menu.

### S-003a: Run in New Terminal

Opens a new VS Code terminal and runs the task command. Triggered by the play button or `tasktree.run` command.

### S-003b: Run in Current Terminal

Sends the task command to the currently active terminal. Triggered by the circle-play button or `tasktree.runInCurrentTerminal` command.

### S-003c: Debug

Launches the task using the VS Code debugger. Only applicable to launch configurations. Triggered by the bug button or `tasktree.debug` command.

## S-004: Quick Tasks

Users can star tasks to pin them in a "Quick Tasks" panel at the top of the tree view. Starred task identifiers are persisted in the `quick` array inside `.vscode/tasktree.json`:

```json
{
  "quick": [
    "npm:build",
    "shell:/path/to/project/scripts/deploy.sh:deploy.sh"
  ]
}
```

## S-005: Tagging

Tags group related tasks for organization and filtering.

### S-005a: Tag Configuration File

Tags are defined in `.vscode/tasktree.json` under the `tags` key:

```json
{
  "tags": {
    "build": ["npm:build", "npm:compile", "make:build"],
    "test": ["npm:test*", "Test:*"],
    "ci": ["npm:lint", "npm:test", "npm:build"]
  }
}
```

This file can be committed to version control to share task organization with a team.

### S-005b: Pattern Syntax

| Pattern | Matches |
|---------|---------|
| `npm:build` | Exact match: npm script named "build" |
| `npm:test*` | Wildcard: npm scripts starting with "test" |
| `*deploy*` | Any task with "deploy" in the name |
| `type:shell:*` | All shell scripts |
| `type:npm:*` | All npm scripts |
| `type:make:*` | All Makefile targets |
| `type:launch:*` | All launch configurations |
| `**/scripts/**` | Path matching: tasks in any `scripts` folder |
| `shell:/full/path:name` | Exact task identifier (used internally for Quick Tasks) |

### S-005c: Managing Tags

- **Add tag to task**: Right-click a task > "Add Tag" > select existing or create new
- **Remove tag from task**: Right-click a task > "Remove Tag"
- **Edit tags file directly**: Command Palette > "TaskTree: Edit Tags Configuration"

## S-006: Filtering

### S-006a: Text Filter

Free-text filter via toolbar or `tasktree.filter` command. Matches against task names.

### S-006b: Tag Filter

Pick a tag from the toolbar picker (`tasktree.filterByTag`) to show only tasks matching that tag's patterns.

### S-006c: Clear Filter

Remove all active filters via toolbar button or `tasktree.clearFilter` command.

## S-007: Parameterized Tasks

Shell scripts with parameter comments prompt the user for input before execution:

```bash
#!/bin/bash
# @description Deploy to environment
# @param environment Target environment (staging, production)

deploy_to "$1"
```

VS Code tasks using `${input:*}` variables prompt automatically via the built-in input UI.

## S-008: Settings

All settings are configured via VS Code settings (`Cmd+,` / `Ctrl+,`).

### S-008a: Exclude Patterns

`tasktree.excludePatterns` - Glob patterns to exclude from task discovery. Default includes `**/node_modules/**`, `**/.vscode-test/**`, and others.

### S-008b: Sort Order

`tasktree.sortOrder` - How tasks are sorted within categories:

| Value | Description |
|-------|-------------|
| `folder` | Sort by folder path, then alphabetically (default) |
| `name` | Sort alphabetically by task name |
| `type` | Sort by task type, then alphabetically |

### S-008c: Show Empty Categories

`tasktree.showEmptyCategories` - Whether to display category nodes that contain no discovered tasks.

## S-009: User Data Storage

TaskTree stores workspace-specific data in `.vscode/tasktree.json`. This file is automatically created and updated as you use the extension. It holds both quick task pins and tag definitions.
