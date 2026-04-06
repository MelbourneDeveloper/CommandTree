# Command Skills

**SPEC-SKILL-001**

> **STATUS: NOT YET IMPLEMENTED**

Command skills are markdown files stored in `.commandtree/skills/` that describe actions to perform on scripts. Each skill adds a context menu item to command items in the tree view.

## Skill File Format

**SPEC-SKILL-010**

Each skill is a single markdown file in `{workspaceRoot}/.commandtree/skills/`. The file contains YAML front matter for metadata followed by markdown instructions.

```markdown
---
name: Clean Up Script
icon: sparkle
---

- Remove superfluous comments from script
- Remove duplication
- Clean up formatting
```

**Front matter fields:**

| Field  | Required | Description                                      |
|--------|----------|--------------------------------------------------|
| `name` | Yes      | Display text shown in the context menu            |
| `icon` | No       | VS Code ThemeIcon id (defaults to `wand`)         |

## Context Menu Integration

**SPEC-SKILL-020**

- On activation (and on file changes in `.commandtree/skills/`), discover all `*.md` files in the skills folder
- Register a dynamic context menu item per skill on command tree items (`viewItem == task`)
- Each menu item shows the `name` from front matter and the chosen icon
- Skills appear in a dedicated `4_skills` menu group in the context menu

## Skill Execution

**SPEC-SKILL-030**

When the user selects a skill from the context menu:

1. Read the target command's script content (using `TaskItem.filePath`)
2. Read the skill markdown body (the instructions)
3. Select a Copilot model via `selectCopilotModel()`
4. Send a request to Copilot with the script content and skill instructions
5. Apply the result back to the script file (with user confirmation via a diff editor)

### Test Coverage
*No tests yet - feature not implemented*
