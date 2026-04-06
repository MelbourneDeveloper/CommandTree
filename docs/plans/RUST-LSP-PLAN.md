# CommandTree Rust LSP Server — Implementation Plan

**SPEC-RLSP-PLAN-001**

This document is the phased implementation plan for the Rust LSP server described in [RUST-LSP-SPEC.md](RUST-LSP-SPEC.md). Every task has a checkbox. The bottom of this document contains a detailed VSIX bundling and deployment checklist.

---

## Phase 1 — Rust Crate Scaffold & Core Parsers

Goal: A working Rust binary that can parse all 19 task types and return JSON results via stdin/stdout, independent of VS Code.

### 1.1 Repository Structure

- [ ] Create `commandtree-lsp/` directory at repo root
- [ ] Create `commandtree-lsp/Cargo.toml` (workspace manifest with members: `lsp-server`, `discovery`, `protocol`)
- [ ] Create `crates/protocol/` crate (`CommandItem`, `ParamDef`, `CommandType`, request/response types)
- [ ] Create `crates/discovery/` crate (orchestration, parsers directory)
- [ ] Create `crates/lsp-server/` crate (binary entry point, `main.rs`)
- [ ] Add `.cargo/config.toml` for cross-compilation target configs
- [ ] Add `rust-toolchain.toml` pinning stable Rust version
- [ ] Add `commandtree-lsp/` to `.gitignore` exclusions as needed (none expected)
- [ ] Verify `cargo check` passes with empty crates

### 1.2 Protocol Crate

- [ ] Define `CommandType` enum (all 19 variants, `serde` rename to lowercase strings)
- [ ] Define `ParamFormat` enum
- [ ] Define `ParamDef` struct with all optional fields, `serde` skip_serializing_if
- [ ] Define `CommandItem` struct matching TypeScript interface
- [ ] Define `DiscoverTasksRequest` and `DiscoverTasksResponse` structs
- [ ] Define `TasksChangedNotification` struct
- [ ] Write unit tests for round-trip JSON serialization of all types
- [ ] Verify field names match existing TypeScript `CommandItem` interface exactly (camelCase via serde)

### 1.3 JSON-format Parsers (no tree-sitter)

These parsers use `serde_json` / `serde_yaml` / `toml` crate — simple and fast.

- [ ] `parsers/npm.rs` — parse `package.json` scripts map → `Vec<CommandItem>`
- [ ] `parsers/launch.rs` — parse `.vscode/launch.json` configurations
- [ ] `parsers/vscode_tasks.rs` — parse `.vscode/tasks.json` tasks
- [ ] `parsers/cargo.rs` — parse `Cargo.toml` `[[bin]]` and `[[example]]` sections
- [ ] `parsers/deno.rs` — parse `deno.json` / `deno.jsonc` (strip comments before parse)
- [ ] `parsers/composer.rs` — parse `composer.json` scripts and `scripts-descriptions`
- [ ] `parsers/taskfile.rs` — parse `Taskfile.y{a}ml` tasks section via `serde_yaml`
- [ ] `parsers/docker.rs` — parse `docker-compose.y{a}ml` services section via `serde_yaml`
- [ ] `parsers/maven.rs` — enumerate standard Maven goals (no file parsing needed)
- [ ] Write unit tests for each parser using fixture files from `test-fixtures/`

### 1.4 Tree-sitter Parsers

- [ ] Add `tree-sitter`, `tree-sitter-bash`, `tree-sitter-python`, `tree-sitter-ruby`, `tree-sitter-xml`, `tree-sitter-json`, `tree-sitter-make`, `tree-sitter-markdown`, `tree-sitter-kotlin` to `discovery/Cargo.toml`
- [ ] Verify each grammar crate compiles (`cargo build`)
- [ ] `parsers/shell.rs` — tree-sitter-bash: extract description from first comment, `@param` annotations
- [ ] `parsers/make.rs` — tree-sitter-make: extract rule target names, skip `.`-prefixed targets
- [ ] `parsers/python.rs` — tree-sitter-python: extract module docstring and `@param` comments
- [ ] `parsers/rake.rs` — tree-sitter-ruby: extract `desc` + `task` pairs
- [ ] `parsers/ant.rs` — tree-sitter-xml: extract `<target name="..." description="...">` elements
- [ ] `parsers/dotnet.rs` — tree-sitter-xml: detect `<OutputType>` and `<PackageReference>` to classify project
- [ ] `parsers/markdown.rs` — tree-sitter-markdown: extract heading and link structure for preview
- [ ] `parsers/gradle.rs` — tree-sitter-kotlin for `.kts`; scanner fallback for Groovy `.gradle`
- [ ] `parsers/powershell.rs` — tree-sitter-powershell if available; otherwise scanner ported from TypeScript
- [ ] `parsers/just.rs` — tree-sitter-just if available; otherwise scanner ported from TypeScript
- [ ] Write unit tests for each tree-sitter parser with realistic fixture content

### 1.5 Discovery Engine

- [ ] `engine.rs` — `discover_all_tasks(root: &Path, excludes: &[String]) -> Vec<CommandItem>`
- [ ] Use `ignore` crate for file walking (respects `.gitignore`, handles excludes)
- [ ] Run all parsers in parallel using `rayon`
- [ ] Implement `generate_command_id(task_type, file_path, name)` matching TypeScript logic exactly
- [ ] Implement `simplify_path(file_path, workspace_root)` matching TypeScript logic exactly
- [ ] Write integration tests running discovery against `test-fixtures/workspace/`

### 1.6 CLI Entry Point

- [ ] `main.rs` — `clap` CLI with subcommands: `discover <root>` (JSON to stdout) and `serve` (LSP mode)
- [ ] `discover` mode: call engine, print JSON, exit 0
- [ ] `--version` flag printing semver
- [ ] `--help` output

---

## Phase 2 — LSP Server

Goal: The binary implements the LSP protocol and can be consumed by the `vscode-languageclient` library.

### 2.1 JSON-RPC Transport

- [ ] Implement LSP content-length framing (read/write headers + body) over stdin/stdout
- [ ] Message loop: read → deserialize → dispatch → serialize → write
- [ ] Handle malformed messages gracefully (log and continue)
- [ ] `initialize` request handler: return server capabilities
- [ ] `initialized` notification handler: no-op
- [ ] `shutdown` request handler: flush and prepare for exit
- [ ] `exit` notification handler: `std::process::exit(0)`

### 2.2 Custom Method Handlers

- [ ] `commandtree/discoverTasks` handler: call `engine::discover_all_tasks`, return `DiscoverTasksResponse`
- [ ] `commandtree/watchFiles` handler: register workspace root for watching
- [ ] File watcher using `notify` crate: emit `commandtree/tasksChanged` on relevant file changes
- [ ] Debounce file change events (500ms) before re-running discovery

### 2.3 Error Reporting

- [ ] Collect non-fatal parse errors as `Warning` structs
- [ ] Return warnings alongside tasks in `DiscoverTasksResponse`
- [ ] Return proper LSP error codes for fatal errors (workspace not found, etc.)

### 2.4 Logging

- [ ] Use `tracing` + `tracing-subscriber` with JSON output to stderr
- [ ] Log level controlled by `COMMANDTREE_LOG` environment variable
- [ ] Log: server start, each discovery run duration, file watcher events, errors

### 2.5 Server Tests

- [ ] Integration test: spawn binary as subprocess, send `initialize` + `commandtree/discoverTasks` over stdin/stdout, assert response
- [ ] Integration test: modify a fixture file, assert `commandtree/tasksChanged` notification arrives

---

## Phase 3 — VS Code Extension Integration

Goal: The TypeScript extension uses the Rust binary via `vscode-languageclient`, gated behind a feature flag.

### 3.1 Extension Wiring

- [ ] Add `vscode-languageclient` to `package.json` dependencies
- [ ] Add `commandtree.useLspServer` boolean setting to `package.json` (default: `false`)
- [ ] Create `src/lsp/client.ts` — `LanguageClient` factory, binary path resolution
- [ ] Create `src/lsp/lspDiscovery.ts` — wraps `sendRequest('commandtree/discoverTasks', ...)` returning `CommandItem[]`
- [ ] Wire `commandtree/tasksChanged` notification to `CommandTreeProvider` refresh
- [ ] In `extension.ts`: if `useLspServer` is true, start LSP client and use `lspDiscovery`; otherwise use existing TypeScript discovery

### 3.2 Output Comparison (Validation Mode)

- [ ] When `commandtree.validateLsp` setting is true, run both backends and log diffs to output channel
- [ ] Helper: `diffTaskLists(ts: CommandItem[], rust: CommandItem[]): Diff[]`
- [ ] Log diffs at debug level; surface critical diffs (missing tasks) as warnings

### 3.3 E2E Tests

- [ ] Add e2e test: activate extension with `useLspServer: true`, assert tree renders same tasks as baseline
- [ ] Add e2e test: modify `package.json` scripts, assert tree updates within 2 seconds

---

## Phase 4 — Binary Packaging & VSIX Bundling

See the **detailed VSIX bundling checklist** below.

---

## Phase 5 — Make LSP Default

- [ ] Set `commandtree.useLspServer` default to `true`
- [ ] Run full e2e test suite against LSP backend
- [ ] Update `SPEC.md` to reference Rust LSP server
- [ ] Update `docs/discovery.md` to document new parser behavior
- [ ] Announce in CHANGELOG

---

## Phase 6 — Remove TypeScript Parsers

- [ ] Delete `src/discovery/shell.ts`, `npm.ts`, `make.ts`, and all 19 discovery TypeScript modules
- [ ] Delete `src/discovery/parsers/powershellParser.ts`
- [ ] Delete `src/discovery/index.ts` (replaced by LSP client)
- [ ] Remove `commandtree.useLspServer` and `commandtree.validateLsp` feature flags
- [ ] Update all tests that referenced TypeScript parser internals
- [ ] Update `SPEC.md`, `docs/discovery.md`

---

## Phase 7 — Zed Extension

- [ ] Create `commandtree-zed/` directory
- [ ] `extension.toml` with language server registration
- [ ] Rust extension code: `language_server_command` returning correct platform binary path
- [ ] Binary download: on install, download platform binary from GitHub Releases
- [ ] Register extension with Zed extension registry
- [ ] Test on macOS (Intel + ARM) and Linux x64
- [ ] Write README with install instructions

---

## Phase 8 — Neovim Plugin

- [ ] Create `commandtree.nvim/` repository
- [ ] `lua/commandtree/lsp.lua` — register `commandtree_lsp` with nvim-lspconfig
- [ ] `lua/commandtree/init.lua` — `discover_tasks()`, `run_task()` public API
- [ ] `lua/commandtree/ui.lua` — Telescope picker integration
- [ ] Optional: fzf-lua integration as alternative to Telescope
- [ ] Binary install: installer script + Mason.nvim registration
- [ ] Write comprehensive README with usage examples

---

## Detailed VSIX Bundling & Deployment Checklist

This section covers every step required to build, sign, and bundle the Rust binary inside the VSIX package.

### Repository Layout

- [ ] Confirm `commandtree-lsp/` (Rust workspace) lives at repo root alongside `src/` and `package.json`
- [ ] Create `bin/` directory at repo root (gitignored); this is where built binaries land locally
- [ ] Add `bin/` to `.gitignore`
- [ ] Add `bin/` to `.vscodeignore` exclusion: ensure `!bin/**` is present so binaries are included in VSIX

### `.vscodeignore` Updates

- [ ] Add `commandtree-lsp/**` to `.vscodeignore` (exclude Rust source from VSIX)
- [ ] Add `!bin/commandtree-lsp-*` to `.vscodeignore` (include compiled binaries)
- [ ] Verify with `vsce ls` that only intended files are included after changes

### Local Build Script

Create `scripts/build-lsp.sh`:

- [ ] `cargo build --release --manifest-path commandtree-lsp/Cargo.toml`
- [ ] Copy binary from `commandtree-lsp/target/release/commandtree-lsp` (or `.exe`) → `bin/commandtree-lsp-{platform}-{arch}`
- [ ] Detect current platform/arch using `uname -s` and `uname -m`
- [ ] Make Unix binaries executable: `chmod +x bin/commandtree-lsp-*`
- [ ] Print checksum of produced binary

### Full Cross-Platform Build Script

Create `scripts/build-lsp-all.sh`:

- [ ] Install `cross` if not present: `cargo install cross`
- [ ] Build for `x86_64-unknown-linux-gnu` via `cross build --release --target ...`
- [ ] Build for `aarch64-unknown-linux-gnu` via `cross build --release --target ...`
- [ ] Build for `x86_64-apple-darwin` via native `cargo build` on macOS runner
- [ ] Build for `aarch64-apple-darwin` via native `cargo build` on macOS runner
- [ ] Build for `x86_64-pc-windows-msvc` via native `cargo build` on Windows runner (or `cross`)
- [ ] Copy each binary to `bin/` with correct filename
- [ ] Generate `bin/checksums.sha256` file

### `package.json` Updates

- [ ] Add `vscode-languageclient` to `dependencies`
- [ ] Add `"postinstall": "node scripts/postinstall.js"` script to download binaries in dev (optional)
- [ ] Add `"build:lsp": "bash scripts/build-lsp.sh"` npm script
- [ ] Add `"package": "npm run compile && npm run build:lsp && vsce package"` (or separate CI step)
- [ ] Verify `vsce package` includes `bin/` directory

### GitHub Actions CI/CD Pipeline

Create `.github/workflows/build-lsp.yml`:

- [ ] Trigger on: push to `main`, pull requests, and release tags (`v*`)
- [ ] **Job: build-linux-x64**
  - [ ] Runner: `ubuntu-latest`
  - [ ] Install Rust stable
  - [ ] `cargo build --release --target x86_64-unknown-linux-gnu`
  - [ ] Upload artifact: `commandtree-lsp-linux-x64`
- [ ] **Job: build-linux-arm64**
  - [ ] Runner: `ubuntu-latest`
  - [ ] Install `cross`: `cargo install cross`
  - [ ] `cross build --release --target aarch64-unknown-linux-gnu`
  - [ ] Upload artifact: `commandtree-lsp-linux-arm64`
- [ ] **Job: build-macos-x64**
  - [ ] Runner: `macos-13` (Intel)
  - [ ] Install Rust stable
  - [ ] `cargo build --release --target x86_64-apple-darwin`
  - [ ] Sign binary (if Apple Developer cert available in secrets)
  - [ ] Upload artifact: `commandtree-lsp-darwin-x64`
- [ ] **Job: build-macos-arm64**
  - [ ] Runner: `macos-latest` (Apple Silicon)
  - [ ] Install Rust stable
  - [ ] `cargo build --release --target aarch64-apple-darwin`
  - [ ] Sign binary (if Apple Developer cert available in secrets)
  - [ ] Upload artifact: `commandtree-lsp-darwin-arm64`
- [ ] **Job: build-windows-x64**
  - [ ] Runner: `windows-latest`
  - [ ] Install Rust stable
  - [ ] `cargo build --release --target x86_64-pc-windows-msvc`
  - [ ] Sign binary (if Authenticode cert available in secrets)
  - [ ] Upload artifact: `commandtree-lsp-win32-x64.exe`
- [ ] **Job: package-vsix**
  - [ ] `needs: [build-linux-x64, build-linux-arm64, build-macos-x64, build-macos-arm64, build-windows-x64]`
  - [ ] Runner: `ubuntu-latest`
  - [ ] Download all 5 artifacts into `bin/`
  - [ ] `npm ci`
  - [ ] `npm run compile`
  - [ ] `npx vsce package`
  - [ ] Upload `.vsix` artifact
- [ ] **Job: publish** (release tags only)
  - [ ] `needs: [package-vsix]`
  - [ ] Publish to VS Code Marketplace: `npx vsce publish --packagePath *.vsix`
  - [ ] Publish to Open VSX: `npx ovsx publish *.vsix`
  - [ ] Create GitHub Release, upload `.vsix` and all 5 binaries as release assets
  - [ ] Upload `bin/checksums.sha256` to GitHub Release

### Secrets Required (GitHub Repository Settings)

- [ ] `VSCE_PAT` — VS Code Marketplace personal access token
- [ ] `OVSX_PAT` — Open VSX registry token
- [ ] `APPLE_DEVELOPER_CERT` — Base64-encoded `.p12` certificate (macOS signing)
- [ ] `APPLE_DEVELOPER_CERT_PASSWORD` — Certificate password
- [ ] `APPLE_TEAM_ID` — Apple Developer Team ID
- [ ] `WINDOWS_CERT` — Base64-encoded Authenticode `.pfx` (Windows signing, optional)
- [ ] `WINDOWS_CERT_PASSWORD` — Certificate password (Windows signing, optional)

### macOS Code Signing (CI)

- [ ] In macOS build job: decode `APPLE_DEVELOPER_CERT` from Base64 and import into keychain
- [ ] Run `codesign --deep --force --verify --verbose --sign "Developer ID Application: ..." bin/commandtree-lsp-darwin-*`
- [ ] Run `codesign --verify --deep --strict bin/commandtree-lsp-darwin-*`
- [ ] Optionally: notarize with `xcrun notarytool` if distributing outside VSIX

### Windows Code Signing (CI)

- [ ] In Windows build job: decode `WINDOWS_CERT` and run `signtool sign /f cert.pfx /p $PASSWORD /t http://timestamp.digicert.com bin/commandtree-lsp-win32-x64.exe`

### Binary Verification in Extension

- [ ] `src/lsp/binaryPath.ts` — `getLspBinaryPath(context: ExtensionContext): string`
- [ ] Check binary exists: if missing, show error message with download link
- [ ] `chmod +x` on Unix if not already executable
- [ ] Run `commandtree-lsp --version` and verify output matches expected semver prefix
- [ ] Cache binary path in extension context for reuse

### Stripping and Optimizing Binaries

- [ ] Set `[profile.release]` in `commandtree-lsp/Cargo.toml`:
  ```toml
  [profile.release]
  opt-level = 3
  lto = true
  codegen-units = 1
  strip = true
  panic = "abort"
  ```
- [ ] Verify binary size is under 10 MB per platform after strip
- [ ] Consider `upx --best` compression for Linux binaries if size is a concern

### Testing the VSIX Bundle

- [ ] Script `scripts/test-vsix.sh`:
  - [ ] Run `vsce package`
  - [ ] Install extension: `code --install-extension commandtree-*.vsix`
  - [ ] Open test workspace
  - [ ] Assert task discovery works via `commandtree.useLspServer: true`
- [ ] Add VSIX smoke test to CI as a non-blocking job on PRs
- [ ] Test on all 3 platforms: macOS, Ubuntu, Windows

### Version Synchronization

- [ ] `commandtree-lsp/crates/lsp-server/Cargo.toml` version must match `package.json` version
- [ ] Add version sync check script `scripts/check-versions.sh` that fails CI if mismatched
- [ ] Add version sync check to `package-vsix` CI job

---

## Testing Strategy

### Unit Tests (Rust)

- [ ] Each parser: test with valid fixture, invalid/malformed content, empty content, edge cases
- [ ] Protocol: serialization round-trips for all types
- [ ] Engine: parallel discovery with mixed parsers
- [ ] Binary selection: platform/arch matrix

### Integration Tests (Rust)

- [ ] Spawn server binary, full LSP handshake, `discoverTasks` call, assert task count
- [ ] Fixture workspace: one file of each supported type, assert each category present
- [ ] File watcher: modify fixture file, assert `tasksChanged` fires within 1 second

### E2E Tests (TypeScript / VS Code)

- [ ] Activate extension with `useLspServer: true`, assert tree shows same categories as baseline
- [ ] Modify `package.json`, assert npm tasks update in tree
- [ ] Modify `Makefile`, assert make targets update in tree
- [ ] Compare output of LSP backend vs TypeScript backend against all test-fixtures

### Performance Tests

- [ ] Benchmark `discoverTasks` on a 500-file workspace (shell script in `scripts/perf-test.sh`)
- [ ] Assert cold start < 500ms, incremental < 50ms
- [ ] Memory: track RSS over 10 discovery cycles, assert < 30MB

---

## Rollback Plan

If the LSP integration introduces regressions:

1. Set `commandtree.useLspServer` to `false` in extension settings (user can self-recover)
2. TypeScript parsers remain in codebase until Phase 6 (two release cycles minimum)
3. If binary fails to start, extension falls back to TypeScript parsers and logs warning
4. Critical regression → revert to previous release tag, patch forward

---

## Definition of Done (per Phase)

| Phase | Done when |
|-------|-----------|
| 1 | All 19 parsers pass unit tests with ≥ 95% coverage; `cargo test` passes |
| 2 | LSP server passes integration tests; `initialize` + `discoverTasks` work |
| 3 | E2E tests pass with `useLspServer: true`; output matches TypeScript baseline |
| 4 | VSIX built by CI includes all 5 binaries; smoke test passes on macOS + Ubuntu + Windows |
| 5 | Default is LSP; all existing E2E tests pass; no regressions |
| 6 | TypeScript parsers deleted; `cargo test` + `npm test` pass; `npm run lint` clean |
| 7 | Zed extension installable; tasks visible in Zed panel |
| 8 | Neovim plugin installable via Mason; Telescope picker shows tasks |
