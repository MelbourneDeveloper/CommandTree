# TaskTree

A VS Code extension that discovers and organizes all runnable tasks in your workspace into a unified, filterable tree view.

## Features

### Task Discovery

TaskTree automatically discovers tasks from multiple sources:

| Source | Description |
|--------|-------------|
| **Shell Scripts** | `.sh` files with optional `@param` and `@description` comments |
| **NPM Scripts** | Scripts defined in `package.json` files (including nested projects) |
| **Make Targets** | Targets from `Makefile` / `makefile` (excludes `.PHONY` and internal `.targets`) |
| **Launch Configs** | Debug configurations from `.vscode/launch.json` |
| **VS Code Tasks** | Tasks from `.vscode/tasks.json` with input variable support |

### Tree Structure

```
TaskTree
├── Shell Scripts (3)
│   ├── Samples/
│   │   └── start.sh
│   └── ICD10CM/.../
│       ├── run.sh
│       └── import.sh
├── NPM Scripts (12)
│   ├── Website/
│   │   ├── dev
│   │   └── build
│   └── Lql/LqlExtension/
│       ├── compile
│       └── watch
├── Make Targets (5)
│   └── build, clean, test...
├── VS Code Launch (3)
│   ├── Dashboard (Fresh)
│   └── ICD-10 CLI
└── VS Code Tasks (27)
    ├── Build: Solution
    └── Test: All
```

### Task Execution

Multiple ways to run tasks:

| Icon | Action | Description |
|------|--------|-------------|
| ▶️ | **Run in New Terminal** | Opens a fresh terminal (inline button) |
| 🐛 | **Debug** | Launches with debugger attached (inline button) |
| ⏵ | **Run in Current Terminal** | Reuses the active terminal (inline button) |

Right-click context menu provides all options plus "Run Task" via VS Code's task system.

### Toolbar Buttons

| Icon | Action |
|------|--------|
| 🔍 | **Filter** - Type to search tasks by name/path |
| 🏷️ | **Tag Filter** - Filter by tag |
| ✖️ | **Clear** - Remove all filters (only shows when filtering) |
| 🔄 | **Refresh** - Rescan workspace for tasks |

### Tag Configuration

Create `.vscode/tasktree.json` to define tags with glob patterns:

```json
{
  "tags": {
    "build": ["npm:build", "npm:compile", "make:build"],
    "test": ["npm:test*", "Test:*"],
    "docker": ["**/Dependencies/**"],
    "ci": ["npm:lint", "npm:test", "npm:build"]
  }
}
```

Pattern matching supports:
- Direct label match: `build.sh`
- Type:label format: `npm:test`, `make:clean`
- Glob wildcards: `*` (segment), `**` (any path)
- Path matching: `**/scripts/**`

Tags appear as badges next to task names.

### Parameter Handling

Tasks with parameters prompt automatically:

**Shell scripts** - Add comments:
```bash
#!/bin/bash
# @description Deploy the application to production
# @param environment The target environment (staging, production)
# @param --dry-run Optional flag for dry run mode

echo "Deploying to $1..."
```

**VS Code tasks** - Uses `${input:*}` definitions from tasks.json

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `tasktree.excludePatterns` | `["**/node_modules/**", "**/bin/**", "**/obj/**", "**/.git/**"]` | Glob patterns to exclude from discovery |
| `tasktree.showEmptyCategories` | `false` | Show categories even when empty |
| `tasktree.sortOrder` | `"folder"` | Sort order: `folder`, `name`, or `type` |

## Commands

| Command | Description |
|---------|-------------|
| `TaskTree: Refresh Tasks` | Reload all tasks |
| `TaskTree: Filter Tasks` | Open text filter input |
| `TaskTree: Filter by Tag` | Show tag picker |
| `TaskTree: Clear Filter` | Remove active filters |
| `TaskTree: Edit Tags Configuration` | Open/create `tasktree.json` |

## Installation

### From VSIX

```bash
cd TaskTree
npm run build-and-install
```

This runs: clean → install → uninstall old → package → install new

### Manual Steps

```bash
npm install
npm run package
code --install-extension tasktree-*.vsix
```

### Development

1. Open `TaskTree/` folder in VS Code
2. Press **F5** to launch Extension Development Host
3. Make changes, reload window (Cmd+R) to test

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run compile` | Compile TypeScript |
| `npm run watch` | Watch mode |
| `npm run test` | Run E2E tests in VS Code |
| `npm run clean` | Delete node_modules, out, *.vsix |
| `npm run package` | Build .vsix |
| `npm run build-and-install` | Full rebuild + reinstall |

## Requirements

- VS Code 1.80.0 or later

## License

MIT
