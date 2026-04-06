# CommandTree Rust LSP Server — Technical Specification

**SPEC-RLSP-001**

## Overview

This document specifies the design for rewriting CommandTree's task-discovery parsers in Rust as a Language Server Protocol (LSP) server. The Rust binary replaces the current TypeScript regex/string-based parsers, providing faster and more accurate parsing via tree-sitter grammars. The same binary is consumed by the VS Code extension today, and serves as the foundation for Zed and Neovim extensions in the future.

---

## Motivation

The current TypeScript parsers have several limitations:

| Problem | Impact |
|---------|--------|
| Regex-based parsing | Breaks on edge cases (multiline strings, comments, nested structures) |
| Runs in VS Code's extension host process | Competes with editor for CPU/memory |
| Language-specific hacks | Each parser is a bespoke hand-rolled state machine |
| No reuse across editors | Cannot power Zed or Neovim integrations |
| TypeScript startup cost | Every file parse invokes JS overhead |

A Rust LSP server solves all of these:
- **Accurate**: tree-sitter grammars handle all edge cases
- **Fast**: native binary, sub-millisecond per-file parse
- **Isolated**: runs in its own process, no contention with the editor
- **Portable**: the same binary powers VS Code, Zed, and Neovim
- **Testable**: parsers are pure Rust functions with no editor dependency

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                VS Code Extension (TypeScript)        │
│                                                     │
│  CommandTreeProvider ──► LSP Client (vscode-        │
│  QuickTasksProvider        languageclient)          │
└────────────────────────────┬────────────────────────┘
                             │ JSON-RPC 2.0 (stdin/stdout)
                             ▼
┌─────────────────────────────────────────────────────┐
│          commandtree-lsp  (Rust binary)             │
│                                                     │
│  ┌──────────────┐   ┌──────────────────────────┐   │
│  │  LSP Server  │   │   Discovery Engine       │   │
│  │  (JSON-RPC)  │──►│                          │   │
│  └──────────────┘   │  per-type parsers        │   │
│                     │  (tree-sitter grammars)  │   │
│                     └──────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Components

#### 1. LSP Server Layer (`src/server/`)
Handles JSON-RPC transport (stdin/stdout), dispatches requests and notifications. Implements the minimum required LSP lifecycle:
- `initialize` / `initialized`
- `shutdown` / `exit`
- `workspace/didChangeWatchedFiles`
- Custom method: `commandtree/discoverTasks`
- Custom notification: `commandtree/tasksChanged`

#### 2. Discovery Engine (`src/discovery/`)
Orchestrates all per-type parsers. Accepts a workspace root and exclude patterns, runs all parsers in parallel (Rayon), and returns a flat `Vec<CommandItem>`.

#### 3. Per-Type Parsers (`src/parsers/`)
One module per task type. Each parser:
- Accepts file content as `&str`
- Returns `Vec<ParsedTask>`
- Uses tree-sitter for structured parsing where a grammar exists
- Falls back to a hand-rolled but unit-tested scanner only for formats with no available grammar

#### 4. File Watcher
Listens for `workspace/didChangeWatchedFiles` and re-runs discovery on change, emitting `commandtree/tasksChanged` notification.

---

## Custom LSP Protocol

The server speaks standard LSP JSON-RPC 2.0 but defines CommandTree-specific methods. These are transport-agnostic and can be used from any LSP client.

### `commandtree/discoverTasks` (Request)

Triggers a full workspace discovery. Blocking until complete.

**Request params:**
```json
{
  "workspaceRoot": "/absolute/path/to/workspace",
  "excludePatterns": ["**/node_modules/**", "**/target/**"]
}
```

**Response:**
```json
{
  "tasks": [
    {
      "id": "npm:/workspace/package.json:build",
      "label": "build",
      "type": "npm",
      "category": "Root",
      "command": "npm run build",
      "cwd": "/workspace",
      "filePath": "/workspace/package.json",
      "tags": [],
      "description": "tsc && vite build"
    }
  ]
}
```

### `commandtree/tasksChanged` (Server → Client Notification)

Sent when a watched file changes and discovery re-runs.

**Params:**
```json
{
  "workspaceRoot": "/absolute/path/to/workspace",
  "tasks": [ /* same shape as discoverTasks response */ ]
}
```

### `commandtree/watchFiles` (Request)

Asks the server to begin watching files for the given workspace root. Triggers `tasksChanged` on modification.

**Request params:**
```json
{
  "workspaceRoot": "/absolute/path/to/workspace",
  "excludePatterns": ["**/node_modules/**"]
}
```

**Response:** `null`

---

## Task Data Model

The Rust `CommandItem` maps 1:1 to the existing TypeScript interface:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandItem {
    pub id: String,
    pub label: String,
    #[serde(rename = "type")]
    pub task_type: CommandType,
    pub category: String,
    pub command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    pub file_path: String,
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Vec<ParamDef>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParamDef {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<ParamFormat>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flag: Option<String>,
}
```

---

## Tree-Sitter Grammar Usage

Each file format maps to a tree-sitter grammar crate. Where no Rust crate exists, a hand-rolled scanner is used (clearly documented and unit-tested).

### Grammar Map

| Task Type | File Pattern(s) | Parsing Method | Grammar Crate |
|-----------|----------------|----------------|---------------|
| `shell` | `**/*.sh`, `**/*.bash`, `**/*.zsh` | tree-sitter | `tree-sitter-bash` |
| `npm` | `**/package.json` | serde_json | — (JSON, no tree-sitter needed) |
| `make` | `**/[Mm]akefile`, `**/GNUmakefile` | tree-sitter | `tree-sitter-make` |
| `launch` | `**/.vscode/launch.json` | serde_json | — |
| `vscode` | `**/.vscode/tasks.json` | serde_json | — |
| `python` | `**/*.py` | tree-sitter | `tree-sitter-python` |
| `powershell` | `**/*.ps1` | tree-sitter | `tree-sitter-powershell` (or scanner) |
| `powershell` | `**/*.bat`, `**/*.cmd` | hand-rolled scanner | — |
| `gradle` | `**/build.gradle` | tree-sitter | `tree-sitter-groovy` (or scanner) |
| `gradle` | `**/build.gradle.kts` | tree-sitter | `tree-sitter-kotlin` |
| `cargo` | `**/Cargo.toml` | toml crate | — |
| `maven` | `**/pom.xml` | tree-sitter | `tree-sitter-xml` |
| `ant` | `**/build.xml` | tree-sitter | `tree-sitter-xml` |
| `just` | `**/[Jj]ustfile`, `**/.justfile` | tree-sitter | `tree-sitter-just` (or scanner) |
| `taskfile` | `**/[Tt]askfile.y{a}ml` | serde_yaml | — |
| `deno` | `**/deno.json{c}` | serde_json | — |
| `rake` | `**/[Rr]akefile{.rb}` | tree-sitter | `tree-sitter-ruby` |
| `composer` | `**/composer.json` | serde_json | — |
| `docker` | `**/docker-compose.y{a}ml`, `**/compose.y{a}ml` | serde_yaml | — |
| `dotnet` | `**/*.csproj`, `**/*.fsproj` | tree-sitter | `tree-sitter-xml` |
| `markdown` | `**/*.md` | tree-sitter | `tree-sitter-markdown` |

### Grammar Crate Versions

```toml
[dependencies]
tree-sitter = "0.24"
tree-sitter-bash = "0.23"
tree-sitter-python = "0.23"
tree-sitter-ruby = "0.23"
tree-sitter-xml = "0.7"
tree-sitter-json = "0.24"
tree-sitter-make = "0.1"          # verify crates.io availability
tree-sitter-markdown = "0.3"
tree-sitter-kotlin = "0.3"
# tree-sitter-powershell, tree-sitter-groovy, tree-sitter-just:
#   use hand-rolled scanners if unavailable on crates.io
```

**Grammar Fallback Policy**: If a grammar crate is unavailable or unmaintained, use a hand-rolled scanner. Hand-rolled scanners must:
- Have 100% unit test coverage
- Document exactly which syntax constructs they handle
- Include a `TODO` reference to the upstream grammar issue

---

## Shell Script Parsing (tree-sitter-bash)

Extract `@param` annotations from comments and the first non-shebang comment as description.

**Query:**
```scheme
; Description: first comment before any code
(comment) @description

; Param annotations: # @param name Description
(comment
  text: (comment) @param-line
  (#match? @param-line "^#\\s*@param"))
```

---

## Makefile Parsing (tree-sitter-make)

Extract target names, skip targets beginning with `.`.

**Query:**
```scheme
(rule
  targets: (targets
    (word) @target-name))
```

---

## Python Script Parsing (tree-sitter-python)

Extract module docstring and `@param` annotations from leading comments.

**Query:**
```scheme
(module
  (expression_statement
    (string) @module-docstring))

(comment) @comment-line
```

---

## Ruby/Rake Parsing (tree-sitter-ruby)

Extract `desc` calls and subsequent `task` definitions.

**Query:**
```scheme
(call
  method: (identifier) @method
  arguments: (argument_list (string) @desc)
  (#eq? @method "desc"))

(call
  method: (identifier) @task-kw
  (#eq? @task-kw "task"))
```

---

## XML Parsing (tree-sitter-xml) — Ant, Maven, .NET

For Ant `build.xml`:
```scheme
(element
  (start_tag
    (tag_name) @tag
    (attribute
      (attribute_name) @attr-name
      (attribute_value) @attr-value))
  (#eq? @tag "target"))
```

For .NET `.csproj`:
```scheme
(element
  (start_tag (tag_name) @tag)
  (#eq? @tag "OutputType"))
```

---

## File Discovery

The Rust server walks the workspace filesystem using `walkdir` or `ignore` (which respects `.gitignore`). The `ignore` crate is preferred as it handles:
- `.gitignore` patterns
- Custom exclude patterns (passed from client)
- Hidden files
- Symlink cycles

File discovery uses parallel iteration via `rayon`.

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Cold start (first `discoverTasks`) | < 500ms for workspaces with ≤ 1000 files |
| Incremental (single file change) | < 50ms |
| Memory (steady state) | < 30 MB RSS |
| Binary size (per platform) | < 10 MB stripped |
| Startup latency (binary launch) | < 100ms |

---

## Binary Distribution Strategy

### Platform Targets

| Platform | Rust Target Triple | Filename |
|----------|-------------------|----------|
| macOS Intel | `x86_64-apple-darwin` | `commandtree-lsp-darwin-x64` |
| macOS Apple Silicon | `aarch64-apple-darwin` | `commandtree-lsp-darwin-arm64` |
| Linux x64 | `x86_64-unknown-linux-gnu` | `commandtree-lsp-linux-x64` |
| Linux ARM64 | `aarch64-unknown-linux-gnu` | `commandtree-lsp-linux-arm64` |
| Windows x64 | `x86_64-pc-windows-msvc` | `commandtree-lsp-win32-x64.exe` |

### VSIX Bundle Layout

```
commandtree-0.x.x.vsix
├── extension/
│   ├── out/                    # TypeScript compiled output
│   ├── bin/
│   │   ├── commandtree-lsp-darwin-x64
│   │   ├── commandtree-lsp-darwin-arm64
│   │   ├── commandtree-lsp-linux-x64
│   │   ├── commandtree-lsp-linux-arm64
│   │   └── commandtree-lsp-win32-x64.exe
│   ├── package.json
│   └── ...
```

### Runtime Binary Selection

In the TypeScript extension, a utility selects the correct binary at activation:

```typescript
function getLspBinaryPath(): string {
  const platform = process.platform;   // 'darwin' | 'linux' | 'win32'
  const arch = process.arch;           // 'x64' | 'arm64'
  const ext = platform === 'win32' ? '.exe' : '';
  const name = `commandtree-lsp-${platform}-${arch}${ext}`;
  return path.join(context.extensionPath, 'bin', name);
}
```

### Binary Verification

On first use, the extension verifies the binary:
1. Check file exists at expected path
2. Check it is executable (chmod on Unix if needed)
3. Run `commandtree-lsp --version` and validate output

### Code Signing

- **macOS**: Sign with Apple Developer ID (`codesign --deep --sign`)
- **Windows**: Sign with Authenticode certificate (`signtool`)
- **Linux**: No signing required; sha256 checksum file shipped alongside

---

## VS Code Client Integration

### Package Changes

Add to `package.json`:
```json
{
  "dependencies": {
    "vscode-languageclient": "^9.0.1"
  }
}
```

### LSP Client Setup

```typescript
import { LanguageClient, ServerOptions, TransportKind } from 'vscode-languageclient/node';

function createLspClient(binaryPath: string): LanguageClient {
  const serverOptions: ServerOptions = {
    command: binaryPath,
    args: ['--stdio'],
    transport: TransportKind.stdio,
  };
  return new LanguageClient(
    'commandtree-lsp',
    'CommandTree LSP',
    serverOptions,
    { documentSelector: [] }  // file watching handled server-side
  );
}
```

### Discovery Call

The `CommandTreeProvider` replaces its current `discoverAllTasks()` call with:

```typescript
const response = await lspClient.sendRequest(
  'commandtree/discoverTasks',
  { workspaceRoot, excludePatterns }
);
```

### Live Updates

The provider subscribes to the server notification:

```typescript
lspClient.onNotification('commandtree/tasksChanged', ({ tasks }) => {
  provider.updateTasks(tasks);
});
```

---

## Zed Extension Design

Zed has first-class LSP support via its [extension API](https://zed.dev/docs/extensions/languages).

### Extension Structure

```
commandtree-zed/
├── extension.toml
├── src/
│   └── lib.rs          # Zed extension entry point
└── languages/
    └── commandtree/
        └── config.toml
```

### `extension.toml`

```toml
[language_servers.commandtree-lsp]
name = "CommandTree LSP"
language = "commandtree"

[language_servers.commandtree-lsp.binary]
path_lookup = false  # we provide the binary
```

### Zed Extension Rust Code

```rust
use zed_extension_api::{self as zed, LanguageServerId, Result};

struct CommandTreeExtension;

impl zed::Extension for CommandTreeExtension {
    fn new() -> Self { CommandTreeExtension }

    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        Ok(zed::Command {
            command: self.language_server_binary_path(language_server_id, worktree)?,
            args: vec!["--stdio".to_string()],
            env: vec![],
        })
    }
}

zed::register_extension!(CommandTreeExtension);
```

### Custom Method Handling (Zed)

Zed exposes custom LSP method handling via `workspace_configuration` and direct JSON-RPC passthrough. The Zed extension calls `commandtree/discoverTasks` and renders results in a custom panel using Zed's UI API.

---

## Neovim Extension Design

### Plugin Structure (Lua)

```
commandtree.nvim/
├── lua/
│   └── commandtree/
│       ├── init.lua          # Public API
│       ├── lsp.lua           # LSP client setup
│       ├── ui.lua            # Telescope/fzf-lua integration
│       └── config.lua        # Default configuration
├── plugin/
│   └── commandtree.lua       # Auto-setup
└── README.md
```

### LSP Registration (`lsp.lua`)

```lua
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

if not configs.commandtree_lsp then
  configs.commandtree_lsp = {
    default_config = {
      cmd = { vim.fn.stdpath('data') .. '/commandtree/bin/commandtree-lsp', '--stdio' },
      filetypes = {},   -- attach to no filetype; workspace-level only
      root_dir = lspconfig.util.root_pattern('.git', 'package.json', 'Makefile'),
      single_file_support = false,
    },
  }
end

lspconfig.commandtree_lsp.setup({})
```

### Task Discovery (`init.lua`)

```lua
local function discover_tasks(callback)
  local client = vim.lsp.get_active_clients({ name = 'commandtree_lsp' })[1]
  if not client then return end

  local workspace_root = vim.fn.getcwd()
  client.request('commandtree/discoverTasks', {
    workspaceRoot = workspace_root,
    excludePatterns = { '**/node_modules/**', '**/target/**' },
  }, function(err, result)
    if err then return end
    callback(result.tasks)
  end)
end
```

### Telescope Integration

```lua
local function show_tasks_telescope()
  discover_tasks(function(tasks)
    require('telescope.pickers').new({}, {
      prompt_title = 'CommandTree Tasks',
      finder = require('telescope.finders').new_table({
        results = tasks,
        entry_maker = function(task)
          return {
            value = task,
            display = task.label .. ' [' .. task.type .. ']',
            ordinal = task.label,
          }
        end,
      }),
      sorter = require('telescope.sorters').get_fuzzy_file(),
      attach_mappings = function(_, map)
        map('i', '<CR>', function(prompt_bufnr)
          local selection = require('telescope.actions.state').get_selected_entry()
          require('telescope.actions').close(prompt_bufnr)
          vim.fn.termopen(selection.value.command, { cwd = selection.value.cwd })
        end)
        return true
      end,
    }):find()
  end)
end
```

### Binary Installation (Neovim)

Binary is distributed via:
1. **GitHub Releases**: Pre-built binaries for all platforms
2. **Mason.nvim**: Register as a Mason tool for one-command install
3. **Manual**: Download script included in plugin

---

## Error Handling

The Rust server uses `Result<T, LspError>` throughout. LSP error codes:

| Code | Meaning |
|------|---------|
| -32700 | Parse error in request |
| -32600 | Invalid request |
| -32601 | Method not found |
| -32000 | Workspace root not found |
| -32001 | File read error (non-fatal, task omitted) |
| -32002 | Grammar parse error (non-fatal, task omitted) |

Non-fatal errors (file read failures, grammar parse errors) are collected and returned as warnings alongside the task list:

```json
{
  "tasks": [...],
  "warnings": [
    { "file": "/path/to/bad.gradle", "message": "Failed to parse Groovy DSL" }
  ]
}
```

---

## Security Considerations

- The binary **never executes** discovered scripts during parsing
- File access is read-only; the binary never writes to the workspace
- All file paths are resolved relative to `workspaceRoot`; paths outside the workspace are rejected
- The binary drops privileges if launched as root (Unix only)
- Grammar parse errors are caught with `catch_unwind`; panics do not crash the server

---

## Crate Structure

```
commandtree-lsp/        # Cargo workspace root
├── Cargo.toml          # workspace manifest
├── crates/
│   ├── lsp-server/     # JSON-RPC server, main binary entry point
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── server.rs
│   │   │   ├── handlers.rs
│   │   │   └── watcher.rs
│   ├── discovery/      # Orchestration + per-type parsers
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   ├── engine.rs
│   │   │   ├── parsers/
│   │   │   │   ├── shell.rs
│   │   │   │   ├── npm.rs
│   │   │   │   ├── make.rs
│   │   │   │   ├── python.rs
│   │   │   │   ├── powershell.rs
│   │   │   │   ├── gradle.rs
│   │   │   │   ├── cargo.rs
│   │   │   │   ├── maven.rs
│   │   │   │   ├── ant.rs
│   │   │   │   ├── just.rs
│   │   │   │   ├── taskfile.rs
│   │   │   │   ├── deno.rs
│   │   │   │   ├── rake.rs
│   │   │   │   ├── composer.rs
│   │   │   │   ├── docker.rs
│   │   │   │   ├── dotnet.rs
│   │   │   │   ├── launch.rs
│   │   │   │   ├── vscode_tasks.rs
│   │   │   │   └── markdown.rs
│   │   │   └── models.rs
│   └── protocol/       # Shared data model + JSON-RPC types
│       └── src/
│           ├── lib.rs
│           ├── types.rs    # CommandItem, ParamDef, CommandType
│           └── messages.rs # Request/response/notification types
```

---

## Rust Dependency Manifest

```toml
[workspace]
members = ["crates/lsp-server", "crates/discovery", "crates/protocol"]

# crates/lsp-server/Cargo.toml
[dependencies]
discovery = { path = "../discovery" }
protocol = { path = "../protocol" }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
tracing = "0.1"
tracing-subscriber = "0.3"
anyhow = "1"
clap = { version = "4", features = ["derive"] }

# crates/discovery/Cargo.toml
[dependencies]
protocol = { path = "../protocol" }
tree-sitter = "0.24"
tree-sitter-bash = "0.23"
tree-sitter-python = "0.23"
tree-sitter-ruby = "0.23"
tree-sitter-xml = "0.7"
tree-sitter-json = "0.24"
tree-sitter-make = "0.1"
tree-sitter-markdown = "0.3"
tree-sitter-kotlin = "0.3"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
serde_yaml = "0.9"
toml = "0.8"
walkdir = "2"
ignore = "0.4"
rayon = "1.10"
anyhow = "1"
glob = "0.3"
```

---

## CI/CD Overview

Cross-compilation runs in GitHub Actions using `cross` (for Linux ARM64) and native macOS/Windows runners.

Full CI/CD details are in [RUST-LSP-PLAN.md](RUST-LSP-PLAN.md).

---

## Migration Path

The TypeScript discovery modules are **not deleted immediately**. The transition is gated:

1. **Phase 1**: Rust server built and tested in isolation (no VS Code changes)
2. **Phase 2**: Feature flag `commandtree.useLspServer` added; both backends run, output compared
3. **Phase 3**: LSP backend becomes default; TypeScript parsers retained but inactive
4. **Phase 4**: TypeScript parsers removed after 2 release cycles of stable LSP operation

This allows rollback at any phase without broken releases.

---

## Open Questions

| # | Question | Decision needed by |
|---|----------|--------------------|
| 1 | Use `lsp-server` crate vs hand-roll JSON-RPC? | Phase 1 start |
| 2 | Embed grammar `.wasm` files or link native `.so`? | Phase 1 start |
| 3 | Sign macOS binary in CI or post-build? | Phase 2 start |
| 4 | Zed extension: package registry or manual install first? | Phase 3 start |
| 5 | Neovim: ship as Mason tool from day 1 or after stable? | Phase 3 start |
| 6 | Retain YAML serde parsing for Taskfile/Docker Compose or add tree-sitter-yaml? | Phase 1 start |
