# Changelog

## 0.9.0

### Changed

- Repository transferred to the [Nimblesite](https://github.com/Nimblesite/CommandTree) organisation; all links updated

### Fixed

- Release process fixes
- SEO improvements across the website

## 0.8.0

### Changed

- Maintenance release

## 0.7.0

### Added

- **Mise task discovery** — discovers tasks from `mise.toml`, `.mise.toml`, `mise.yaml`, and `.mise.yaml`, including task descriptions
- TOML parser now recognises `[tasks.name]` sections without requiring a bare `[tasks]` preamble
- Pure `parsers/miseParser.ts` extracted for testability
- Lock recovery spec and `[DISC-PARSE-STRATEGY]` parsing strategy spec
- Cross-platform `Makefile` with OS detection, help target, and standardised public/private targets

### Changed

- Bumped supported command count to 22 (adds Mise alongside C# Script and F# Script)
- DB layer simplified — `initSchema`, `registerCommand`, `ensureCommandExists`, `closeDatabase`, tag mutators, `upsertSummary`, etc. now return directly and throw only on unrecoverable errors. New `getDbOrThrow()` replaces repeated `getDb()` + `Result` unwrapping
- `CommandTreeProvider`, `QuickTasksProvider`, `TagConfig`, `extension.ts`, `TaskRunner`, and `summaryPipeline` simplified by removing `Result` unwrapping boilerplate
- `CLAUDE.md` / `Agents.md` consolidated with logging standards, spec ID rules, and updated command table
- `.prettierrc` renamed to `.prettierrc.json` with explicit settings
- `.gitignore` expanded with universal patterns and secret exclusions
- Docs reorganised into `docs/specs/` and `docs/plans/`
- Coverage thresholds updated to reflect current coverage
- README updated for 22 tool types

### Removed

- `.github/workflows/deploy.yml` (superseded by `release.yml` post-release job)
- Stale `CoveragePlan.md`

## 0.6.0

### Added

- **C# Script (.csx) discovery** via new `discovery/csharp-script.ts`
- **F# Script (.fsx) discovery** via new `discovery/fsharp-script.ts`
- Reusable helpers extracted: `powershellParser.ts`, `nodeFactory.ts`, `tagSync.ts`, `watchers.ts`
- New unit test suites: `discovery.unit.test.ts`, `modelSelection.unit.test.ts`, `taskRunner.unit.test.ts`, `treehierarchy.unit.test.ts`
- CI format check, spell check, and 90% coverage threshold
- Claude skills: `ci-prep`, `fix-bug`
- Rust LSP plan and spec docs

### Changed

- Refactored `CommandTreeProvider`, `QuickTasksProvider`, and `TagConfig` for reduced complexity and a more functional style
- Reorganised semantic/db layer — moved `db.ts` from `semantic/` to `db/` and added `lifecycle.ts`
- Replaced fake/indirect tests with proper E2E coverage
- Tightened ESLint, Prettier, and `tsconfig` rules
- Split `SPEC.md` into focused docs

### Removed

- Unused embedding modules: `embedder.ts`, `embeddingPipeline.ts`, `similarity.ts`, `store.ts`, plus related types and index
- Copilot-dependent tests excluded from CI

## 0.5.0

### Added

- **GitHub Copilot AI Summaries** — discovered commands are automatically summarised in plain language by GitHub Copilot, displayed in tooltips on hover
- Security warnings: commands that perform dangerous operations (e.g. `rm -rf`, force-push) are flagged with a warning in the tree view
- `commandtree.enableAiSummaries` setting to toggle AI summaries (enabled by default)
- `commandtree.generateSummaries` command to manually trigger summary generation
- Content-hash change detection — summaries only regenerate when scripts change

### Fixed

- Terminal execution no longer throws when xterm viewport is uninitialised in headless environments

## 0.4.0

### Added

- SQLite storage for summaries and embeddings via `node-sqlite3-wasm`
- Automatic migration from legacy JSON store to SQLite on activation
- File watcher re-summarises scripts when they change, with user notification

### Fixed

- Corrected homepage link to commandtree.dev in package.json and README
- Fixed website deployment prefix issue for custom domain

## 0.3.0

### Added

- Demo GIF showcasing CommandTree in action on README and website
- Website demo section with window-chrome frame and caption below the hero
- Deployment script fix for release workflow

## 0.2.0

### Added

- See [Release 0.2.0](https://github.com/Nimblesite/CommandTree/releases/tag/v0.2.0)

## 0.1.0 - Initial Release

### Features

- Automatic discovery of shell scripts, npm scripts, Makefile targets, VS Code tasks, launch configurations, and Python scripts
- Unified tree view in the sidebar with collapsible categories
- Folder-based grouping with nested directory hierarchy
- Run commands in a new terminal or the current terminal
- Debug launch configurations directly from the tree
- Quick Launch panel for pinning frequently-used commands
- Tag system with pattern-based auto-tagging (by type, label, or exact ID)
- Text filter and tag filter with toolbar controls
- Configurable exclude patterns and sort order (folder, name, type)
- File watcher for automatic refresh on config and script changes
- Parameterized command support with input prompts
