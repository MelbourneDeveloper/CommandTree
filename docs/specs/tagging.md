# Tagging

**SPEC-TAG-001**

Tags are simple one-word identifiers (e.g., "build", "test", "deploy") that link to commands via a many-to-many relationship in the database.

## Command ID Format

**SPEC-TAG-010**

Every command has a unique ID generated as: `{type}:{filePath}:{name}`

Examples:
- `npm:/Users/you/project/package.json:build`
- `shell:/Users/you/project/scripts/deploy.sh:deploy.sh`
- `make:/Users/you/project/Makefile:test`
- `launch:/Users/you/project/.vscode/launch.json:Launch Chrome`

## How Tagging Works

**SPEC-TAG-020**

1. User right-clicks a command and selects "Add Tag"
2. Tag is created in `tags` table if it doesn't exist: `(tag_id UUID, tag_name, description)`
3. Junction record is created in `command_tags` table: `(command_id, tag_id, display_order)`
4. The `command_id` is the exact ID string from above
5. To filter by tag: `SELECT c.* FROM commands c JOIN command_tags ct ON c.command_id = ct.command_id JOIN tags t ON ct.tag_id = t.tag_id WHERE t.tag_name = 'build'`
6. Display the matching commands in the tree view

**No pattern matching, no wildcards** - just exact `command_id` matching via straightforward database JOINs.

### Test Coverage
- [tagging.e2e.test.ts](../src/test/e2e/tagging.e2e.test.ts): "E2E: Add tag via UI → exact ID stored in junction table", "E2E: Remove tag via UI → junction record deleted", "E2E: Cannot add same tag twice (UNIQUE constraint)", "E2E: Filter by tag → only exact ID matches shown"
- [tagconfig.e2e.test.ts](../src/test/e2e/tagconfig.e2e.test.ts): "E2E: Add tag via UI → exact ID stored in junction table", "E2E: Remove tag via UI → junction record deleted"

## Database Operations

**SPEC-TAG-030**

Implemented in `src/semantic/db.ts`:

- `addTagToCommand(params)` - Creates tag in `tags` table if needed, then adds junction record
- `removeTagFromCommand(params)` - Removes junction record from `command_tags`
- `getCommandIdsByTag(params)` - Returns all command IDs for a tag (ordered by `display_order`)
- `getTagsForCommand(params)` - Returns all tags assigned to a command
- `getAllTagNames(handle)` - Returns all distinct tag names from `tags` table
- `updateTagDisplayOrder(params)` - Updates display order in `command_tags` for drag-and-drop

### Test Coverage
- [db.e2e.test.ts](../src/test/e2e/db.e2e.test.ts): "addTagToCommand creates tag and junction record", "addTagToCommand is idempotent", "removeTagFromCommand removes junction record", "removeTagFromCommand succeeds for non-existent tag", "getAllTagNames returns all distinct tags"

## Managing Tags

**SPEC-TAG-040**

- **Add tag to command**: Right-click a command > "Add Tag" > select existing or create new
- **Remove tag from command**: Right-click a command > "Remove Tag"

### Test Coverage
- [tagging.e2e.test.ts](../src/test/e2e/tagging.e2e.test.ts): "addTag command is registered", "removeTag command is registered", "addTag and removeTag are in view item context menu", "tag commands are in 3_tagging group"

## Tag Filter

**SPEC-TAG-050**

Pick a tag from the toolbar picker (`commandtree.filterByTag`) to show only commands that have that tag assigned in the database.

### Test Coverage
- [filtering.e2e.test.ts](../src/test/e2e/filtering.e2e.test.ts): "filterByTag command is registered"

## Clear Filter

**SPEC-TAG-060**

Remove all active filters via toolbar button or `commandtree.clearFilter` command.

### Test Coverage
- [filtering.e2e.test.ts](../src/test/e2e/filtering.e2e.test.ts): "clearFilter command is registered"

## Tag Config Sync

**SPEC-TAG-070**

Tags from `commandtree.json` are synced to the database at activation.

### Test Coverage
- [tagging.e2e.test.ts](../src/test/e2e/tagging.e2e.test.ts): "E2E: Tags from commandtree.json are synced at activation"
- [tagconfig.e2e.test.ts](../src/test/e2e/tagconfig.e2e.test.ts): "E2E: Tags from commandtree.json are synced at activation"
