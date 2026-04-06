# Quick Launch

**SPEC-QL-001**

Users can star commands to pin them in a "Quick Launch" panel at the top of the tree view. Starred command identifiers are persisted as `quick` tags in the database.

## Adding to Quick Launch

**SPEC-QL-010**

Right-click a command and select "Add to Quick Launch" or use the `commandtree.addToQuick` command.

### Test Coverage
- [quicktasks.e2e.test.ts](../src/test/e2e/quicktasks.e2e.test.ts): "addToQuick command is registered", "E2E: Add quick command → stored in junction table"

## Removing from Quick Launch

**SPEC-QL-020**

Right-click a quick command and select "Remove from Quick Launch" or use the `commandtree.removeFromQuick` command.

### Test Coverage
- [quicktasks.e2e.test.ts](../src/test/e2e/quicktasks.e2e.test.ts): "removeFromQuick command is registered", "E2E: Remove quick command → junction record deleted"

## Display Order

**SPEC-QL-030**

Quick launch items maintain insertion order via `display_order` column in the `command_tags` junction table. Items can be reordered via drag-and-drop.

### Test Coverage
- [quicktasks.e2e.test.ts](../src/test/e2e/quicktasks.e2e.test.ts): "E2E: Quick commands ordered by display_order", "display_order column maintains insertion order"

## Duplicate Prevention

**SPEC-QL-040**

The same command cannot be added to quick launch twice. The UNIQUE constraint on `(command_id, tag_id)` prevents duplicates.

### Test Coverage
- [quicktasks.e2e.test.ts](../src/test/e2e/quicktasks.e2e.test.ts): "E2E: Cannot add same command to quick twice"

## Empty State

**SPEC-QL-050**

When no commands are starred, the Quick Launch panel shows a placeholder message.

### Test Coverage
- [quicktasks.e2e.test.ts](../src/test/e2e/quicktasks.e2e.test.ts): "Quick tasks view shows placeholder when empty"
