# Settings

**SPEC-SET-001**

All settings are configured via VS Code settings (`Cmd+,` / `Ctrl+,`).

## Exclude Patterns

**SPEC-SET-010**

`commandtree.excludePatterns` - Glob patterns to exclude from command discovery. Default includes `**/node_modules/**`, `**/.vscode-test/**`, and others.

### Test Coverage
- [configuration.e2e.test.ts](../src/test/e2e/configuration.e2e.test.ts): "excludePatterns setting exists", "excludePatterns has sensible defaults", "exclude patterns use glob syntax", "exclude patterns support common directories"

## Sort Order

**SPEC-SET-020**

`commandtree.sortOrder` - How commands are sorted within categories:

| Value | Description |
|-------|-------------|
| `folder` | Sort by folder path, then alphabetically (default) |
| `name` | Sort alphabetically by command name |
| `type` | Sort by command type, then alphabetically |

### Test Coverage
- [configuration.e2e.test.ts](../src/test/e2e/configuration.e2e.test.ts): "sortOrder setting exists", "sortOrder has valid enum values", "sortOrder defaults to folder", "sortOrder has descriptive enum descriptions", "sortOrder config has valid value"

## Configuration Reading

**SPEC-SET-030**

Settings are read from the VS Code workspace configuration. The configuration section title is "CommandTree".

### Test Coverage
- [configuration.e2e.test.ts](../src/test/e2e/configuration.e2e.test.ts): "workspace settings are read correctly", "configuration has correct section title"
