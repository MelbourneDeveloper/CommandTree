# Extension Registration

**SPEC-EXT-001**

CommandTree is a VS Code extension that registers commands, views, and menus on activation.

## Activation

**SPEC-EXT-010**

The extension activates on view visibility and registers all commands and tree views.

### Test Coverage
- [commands.e2e.test.ts](../src/test/e2e/commands.e2e.test.ts): "extension is present", "extension activates successfully", "extension activates on view visibility"

## Command Registration

**SPEC-EXT-020**

All commands are registered with the `commandtree.` prefix:

| Command ID | Description |
|------------|-------------|
| `commandtree.refresh` | Reload all tasks |
| `commandtree.run` | Run task in new terminal |
| `commandtree.runInCurrentTerminal` | Run in active terminal |
| `commandtree.debug` | Launch with debugger |
| `commandtree.filter` | Text filter input |
| `commandtree.filterByTag` | Tag filter picker |
| `commandtree.clearFilter` | Clear all filters |
| `commandtree.editTags` | Open commandtree.json |
| `commandtree.addTag` | Add tag to command |
| `commandtree.removeTag` | Remove tag from command |
| `commandtree.addToQuick` | Add to quick launch |
| `commandtree.removeFromQuick` | Remove from quick launch |
| `commandtree.refreshQuick` | Refresh quick launch view |
| `commandtree.generateSummaries` | Generate AI summaries |
| `commandtree.selectModel` | Select AI model |
| `commandtree.openPreview` | Open markdown preview |

### Test Coverage
- [commands.e2e.test.ts](../src/test/e2e/commands.e2e.test.ts): "all commands are registered"

## Tree View Registration

**SPEC-EXT-030**

The extension registers two tree views in a custom sidebar container (`commandtree-container`):
- `commandtree` - Main command tree
- `commandtree-quick` - Quick launch panel

### Test Coverage
- [commands.e2e.test.ts](../src/test/e2e/commands.e2e.test.ts): "tree view is registered in custom container", "tree view has correct configuration", "views are in custom container"

## Menu Contributions

**SPEC-EXT-040**

Commands appear in view title bars and context menus with appropriate icons and visibility conditions.

### Test Coverage
- [commands.e2e.test.ts](../src/test/e2e/commands.e2e.test.ts): "view title menu has correct commands", "context menu has run command for tasks", "clearFilter only visible when filter is active", "no duplicate commands in commandtree view/title menu", "no duplicate commands in commandtree-quick view/title menu", "commandtree view has exactly 3 title bar icons", "commandtree-quick view has exactly 3 title bar icons"

## Command Icons

**SPEC-EXT-050**

Each command has an appropriate ThemeIcon for display in menus and tree items.

### Test Coverage
- [commands.e2e.test.ts](../src/test/e2e/commands.e2e.test.ts): "commands have appropriate icons"

## Package Configuration

**SPEC-EXT-060**

The extension's package.json defines metadata, engine requirements, and entry point.

### Test Coverage
- [commands.e2e.test.ts](../src/test/e2e/commands.e2e.test.ts): "package.json has correct metadata", "package.json has correct engine requirement", "package.json has main entry point"

## Workspace Trust

**SPEC-EXT-070**

The extension works in trusted workspaces.

### Test Coverage
- [commands.e2e.test.ts](../src/test/e2e/commands.e2e.test.ts): "extension works in trusted workspace"
