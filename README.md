# TaskTree

One sidebar. Every task in your workspace.

TaskTree scans your project and surfaces all runnable tasks in a single tree view: shell scripts, npm scripts, Makefile targets, VS Code tasks, and launch configurations. Filter by text or tag, run in terminal or debugger.

## What It Finds

- **Shell Scripts** - `.sh` files with optional `@param` and `@description` comments
- **NPM Scripts** - From all `package.json` files including nested projects
- **Makefile Targets** - From `Makefile` and `makefile`
- **Launch Configs** - Debug configurations from `.vscode/launch.json`
- **VS Code Tasks** - From `.vscode/tasks.json` with input variable support
- **Python Scripts** - Anything with a `.py` extension

## Running Tasks

Click a task or use the inline buttons:
- **Play** - Run in new terminal
- **Bug** - Launch with debugger
- **Circle Play** - Run in current terminal

Right-click for the full context menu.

## Quick Tasks

Star frequently-used tasks to pin them in the Quick Tasks panel at the top. No more hunting through the tree.

## Tagging

Create `.vscode/tasktree.json` to group related tasks:

```json
{
  "tags": {
    "build": ["npm:build", "npm:compile", "make:build"],
    "test": ["npm:test*", "Test:*"],
    "ci": ["npm:lint", "npm:test", "npm:build"]
  }
}
```

Patterns:
- `npm:build` - Exact match on type and label
- `npm:test*` - Wildcard matching
- `**/scripts/**` - Path matching
- `type:npm:*` - Match all tasks of a type

Filter by tag from the toolbar to see just what you need.

## Parameterized Tasks

Shell scripts with parameter comments prompt for input:

```bash
#!/bin/bash
# @description Deploy to environment
# @param environment Target environment (staging, production)

deploy_to "$1"
```

VS Code tasks using `${input:*}` variables work automatically.

## Settings

Configure via VS Code settings (`Cmd+,` or `Ctrl+,`).

### `tasktree.excludePatterns`

Glob patterns to exclude from task discovery. Default:

```json
[
  "**/node_modules/**",
  "**/.vscode-test/**",
  // [...]
]
```

### `tasktree.sortOrder`

How to sort tasks within categories:

| Value | Description |
|-------|-------------|
| `folder` | Sort by folder path, then alphabetically by name (default) |
| `name` | Sort alphabetically by task name |
| `type` | Sort by task type, then alphabetically by name |

## User Data

TaskTree stores workspace-specific data in `.vscode/tasktree.json`. This file is automatically created and updated as you use the extension.

### Quick Tasks

When you star a task (click the star icon or "Add to Quick Tasks"), its identifier is added to the `quick` array:

```json
{
  "tags": {
    "quick": [
      "npm:build",
      "shell:/path/to/project/scripts/deploy.sh:deploy.sh"
    ]
  }
}
```

Quick tasks appear in the "Quick Tasks" panel at the top of the TaskTree sidebar for fast access.

### Tags

Tags group related tasks for filtering. Each tag maps to an array of task patterns:

```json
{
  "tags": {
    "build": ["npm:build", "npm:compile", "make:build"],
    "test": ["npm:test*", "**/test*.sh"],
    "deploy": ["*deploy*", "type:shell:deploy*"],
    "ci": ["npm:lint", "npm:test", "npm:build"]
  }
}
```

#### Pattern Syntax

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

#### Managing Tags

- **Add tag to task**: Right-click a task → "Add Tag" → select existing or create new
- **Remove tag from task**: Right-click a task → "Remove Tag"
- **Edit tags file directly**: Command Palette → "TaskTree: Edit Tags Configuration"
- **Filter by tag**: Click the tag icon in the toolbar

The file is JSON and can be committed to version control to share task organization with your team.

## Install

From source:
```bash
npm install
npm run package
code --install-extension tasktree-*.vsix
```

## License

MIT
