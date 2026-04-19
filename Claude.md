<!-- agent-pmo:424c8f8 -->
# CommandTree — Agent Instructions

⚠️ CRITICAL: **Reduce token usage.** Check file size before loading. Write less. Delete fluff and dead code. Alert user when context is loaded with pointless files. ⚠️ 

⚠️ ASKING THE USER IF THEY WANT TO PROCEED, OR TO CLARIFY IS ⛔️ ILLEGAL. JUST DO IT!! ⚠️ 

> Read this entire file before writing any code.
> These rules are NON-NEGOTIABLE. Violations will be rejected in review.

## Project Overview

CommandTree is a VS Code extension that discovers and organizes runnable tasks (npm scripts, Makefiles, shell scripts, launch configs, etc.) into a unified tree view sidebar. It supports tagging, quick launch, AI-generated summaries, and 20+ task discovery providers.

**Primary language(s):** TypeScript
**Build command:** `make ci`
**Test command:** `make test`
**Lint command:** `make lint`

## Hard Rules (no exceptions)

- **DO NOT use git commands.** No `git add`, `git commit`, `git push`, `git checkout`, `git merge`, `git rebase`, or any other git command. CI and GitHub Actions handle git.
- **ZERO DUPLICATION.** Before writing any code, search the codebase for existing implementations. Move code, don't copy it.
- **NO THROWING EXCEPTIONS.** Return `Result<T,E>` using a discriminated union. Exceptions are only for unrecoverable bugs (panic-level).
- **NO REGEX on structured data.** Never parse JSON, YAML, TOML, code, or any structured format with regex. Use proper parsers, AST tools, or library functions.
- **NO PLACEHOLDERS.** If something isn't implemented, leave a loud compilation error with TODO. Never write code that silently does nothing.
- **Functions < 20 lines.** Refactor aggressively. If a function exceeds 20 lines, split it.
- **Files < 450 lines.** If a file exceeds 450 lines, extract modules.
- **No suppressing linter warnings.** Fix the code, not the linter. Fix lint errors IMMEDIATELY.
- **CENTRALIZE global state** in one type/file.
- **TypeScript strict mode** — No `any`, no implicit types, all lints set to error. `tsconfig.json` must have `"strict": true`.
- No `!` (non-null assertion) — use optional chaining or explicit guards.
- No implicit `any` — all function parameters and return types must be annotated.
- No `// @ts-ignore` or `// @ts-nocheck`.
- No `as Type` casts without a comment explaining why it's safe.
- **Decouple providers from the VS Code SDK** — No vscode sdk use within the providers.


## Principles

- **100% test coverage is the goal.** Never delete or skip tests. Never remove assertions.
- **Prefer E2E/integration tests.** Unit tests are acceptable only for isolating problems.
- **Pure functions** over statements. Prefer const and immutable patterns.
- **No string literals** — Named constants only, in ONE location.
- **Named parameters** — Use object params for functions with 3+ args.
- **No commented-out code** — Delete it.
- **Every spec section MUST have a unique, hierarchical, non-numeric ID.** Format: `[GROUP-TOPIC]` or `[GROUP-TOPIC-DETAIL]` (e.g., `[AUTH-TOKEN-VERIFY]`, `[CI-TIMEOUT]`). The first word is the **group** — all sections in the same group MUST be adjacent in the spec's TOC. NEVER use sequential numbers like `[SPEC-001]`. All code, tests, and design docs that implement or relate to a spec section MUST reference its ID in a comment.

## Logging Standards

- **Use a structured logging library.** Never use `console.log` for diagnostics. Use a proper structured logging library.
- **Log at entry/exit of all significant operations.** Use appropriate levels: `error`, `warn`, `info`, `debug`, `trace`.
- **Structured fields over string interpolation.** Log `{ "userId": 42, "action": "checkout" }` not `"User 42 performed checkout"`.
- **VS Code extensions:** Write detailed logs to a file in the extension's state folder. Basic errors and diagnostics MUST also appear in the extension's VS Code Output Channel so users can see them without hunting for files.
- **NEVER log personal data.** No names, emails, addresses, phone numbers, IP addresses, or any PII.
- **NEVER log secrets.** No API keys, tokens, passwords, connection strings, or credentials.

### Logging Library

| Language | Library | Notes |
|----------|---------|-------|
| TypeScript/Node | `pino` | JSON structured logging; use `pino-pretty` for dev |

## Too Many Cooks (Multi-Agent Coordination)

If the TMC server is available:
1. Register immediately: descriptive name, intent, files you will touch
2. Before editing any file: lock it via TMC
3. Broadcast your plan before starting work
4. Check messages every few minutes
5. Release locks immediately when done
6. Never edit a locked file — wait or find another approach

### CSS

- **Minimize duplication** — fewer classes is better
- **Don't include section in class name** — name them after what they are - not the section they sit in

## Testing Rules

- **Never delete a failing test.** Fix the code or fix the test expectation — never delete.
- **Never skip a test** without a ticket number and expiry date in the skip reason.
- **Assertions must be specific.** `assert.ok(true)` without a condition is illegal.
- **No try/catch in tests** that swallows the exception and asserts success.
- **Tests must be deterministic.** No sleep(), no relying on timing, no random state.
- **E2E tests: black-box only.** Only interact via VS Code commands or UI. Never call provider methods directly.
- NEVER KILL VSCODE PROCESSES
- Separate e2e tests from unit tests by file
- Tests must prove USER INTERACTIONS work
- E2E tests should have multiple user interactions each and loads of assertions
- Prefer adding assertions to existing tests rather than adding new tests
- Test files in `src/test/suite/*.test.ts`
- Run tests: `npm test`
- FAILING TEST = OK. TEST THAT DOESN'T ENFORCE BEHAVIOR = ILLEGAL
- Unit test = No VSCODE instance needed = isolation only test

### Automated (E2E) Testing

**AUTOMATED TESTING IS BLACK BOX TESTING ONLY**
Only test the UI **THROUGH the UI**. Do not run commands etc. to coerce the state.

- Tests run in actual VS Code window via `@vscode/test-electron`
- Automated tests must not modify internal state or call functions that do:
  - No calling internal methods like provider.updateTasks()
  - No calling provider.refresh() directly
  - No manipulating internal state directly
  - No using any method not exposed via VS Code commands
  - No using commands that should just happen as part of normal use (e.g., commandtree.refresh)

### Test First Process
- Write test that fails because of bug/missing feature
- Run tests to verify that test fails because of this reason
- Adjust test and repeat until you see failure for the reason above
- Add missing feature or fix bug
- Run tests to verify test passes
- Repeat and fix until test passes WITHOUT changing the test

### Fake Tests Are Illegal

A "fake test" is any test that passes without actually verifying behavior:
- `assert.ok(true, 'Should work')` — asserts true unconditionally
- `try { await doSomething(); } catch { } assert.ok(true)` — no assertion on actual behavior
- Only checking config file, not actual UI/view behavior
- Empty catch with success assertion

## Website

**Optimise for SEO and AI**: always pay attention to this when writing content

[Top ways to ensure content performs well in Google's AI experiences](https://developers.google.com/search/blog/2025/05/succeeding-in-ai-search)
[SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
[How to optimise AI overviews](https://studiohawk.com.au/blog/how-to-optimise-ai-overviews/)
[Optimizing content for AI search](https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers)
[Implementing Social Media Preview Cards](https://documentation.platformos.com/use-cases/implementing-social-media-preview-cards)

## Build Commands (cross-platform via GNU Make)

Seven standard targets — see REPO-STANDARDS-SPEC [MAKE-TARGETS]:

```bash
make build   # compile TypeScript
make test    # FAIL-FAST tests + coverage + threshold enforcement (the only test entry point)
make lint    # ESLint + cspell (read-only, no formatting)
make fmt     # Prettier format in-place; `make fmt CHECK=1` for read-only check
make clean   # remove build artifacts
make ci      # lint + test + build
make setup   # post-create dev environment setup
```

Repo-specific: `make package` builds the VSIX.

Coverage thresholds live in `coverage-thresholds.json` (`default_threshold`) — the single source of truth per [COVERAGE-THRESHOLDS-JSON]. Never set thresholds via env vars, GitHub repo variables, or CI YAML. Ratchet only — never lower.

## Critical Docs

### VS Code SDK
[VSCode Extension API](https://code.visualstudio.com/api/)
[VSCode Extension Testing API](https://code.visualstudio.com/api/extension-guides/testing)
[VSCODE Language Model API](https://code.visualstudio.com/api/extension-guides/ai/language-model)
[Language Model Tool API](https://code.visualstudio.com/api/extension-guides/ai/tools)
[AI extensibility in VS Code](https://code.visualstudio.com/api/extension-guides/ai/ai-extensibility-overview)
[AI language models in VS Code](https://code.visualstudio.com/docs/copilot/customization/language-models)

## Repo Structure

```
CommandTree/
├── .claude/skills/          # Agent skills
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── release.yml
│   │   └── deploy-pages.yml
│   └── pull_request_template.md
├── docs/
│   ├── specs/               # Behavior specifications
│   └── plans/               # Goal-oriented plans with TODO checklists
├── src/
│   ├── extension.ts         # Entry point, command registration
│   ├── CommandTreeProvider.ts  # TreeDataProvider implementation
│   ├── config/
│   │   └── TagConfig.ts     # Tag configuration from commandtree.json
│   ├── discovery/           # 20+ task discovery providers
│   ├── models/
│   │   └── TaskItem.ts      # Task data model and TreeItem
│   ├── runners/
│   │   └── TaskRunner.ts    # Task execution logic
│   └── test/
│       └── suite/           # E2E test files
├── test-fixtures/           # Test workspace files
├── website/                 # 11ty static site
├── package.json             # Extension manifest
├── tsconfig.json            # TypeScript config
├── eslint.config.mjs        # ESLint flat config
├── .prettierrc.json         # Prettier config
├── Makefile                 # Build targets
└── .vscode-test.mjs         # Test runner config
```

## Commands

| Command ID | Description |
|------------|-------------|
| `commandtree.refresh` | Reload all tasks |
| `commandtree.run` | Run task in new terminal |
| `commandtree.runInCurrentTerminal` | Run in active terminal |
| `commandtree.filterByTag` | Tag filter picker |
| `commandtree.clearFilter` | Clear all filters |
| `commandtree.addTag` | Add tag to command |
| `commandtree.removeTag` | Remove tag from command |
| `commandtree.addToQuick` | Add to quick launch |
| `commandtree.removeFromQuick` | Remove from quick launch |
| `commandtree.refreshQuick` | Refresh quick launch view |
| `commandtree.generateSummaries` | Generate AI summaries |
| `commandtree.selectModel` | Select AI model |
| `commandtree.openPreview` | Open markdown preview |

## Adding New Task Types

1. Create discovery module in `src/discovery/`
2. Export discovery function: `discoverXxxTasks(root: string, excludes: string[]): Promise<TaskItem[]>`
3. Add to `discoverAllTasks()` in `src/discovery/index.ts`
4. Add category in `CommandTreeProvider.buildRootCategories()`
5. Handle execution in `TaskRunner.run()`
6. Add E2E tests in `src/test/suite/discovery.test.ts`

## Configuration

Settings defined in `package.json` under `contributes.configuration`:
- `commandtree.excludePatterns` - Glob patterns to exclude
- `commandtree.sortOrder` - Task sort order (folder/name/type)
