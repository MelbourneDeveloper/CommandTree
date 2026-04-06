# CommandTree Specification

**SPEC-ROOT-001**

## Overview

CommandTree scans a VS Code workspace and surfaces all runnable commands in a single tree view sidebar panel. It discovers shell scripts, npm scripts, Makefile targets, VS Code tasks, launch configurations, etc then presents them in a categorized, filterable tree.

**Tree Rendering Architecture:**

The tree view is generated **directly from the file system** by parsing package.json, Makefiles, shell scripts, etc. All core functionality (running commands, tagging, filtering by tag) works without a database.

The SQLite database **enriches** the tree with AI-generated summaries:
- **Database empty**: Tree displays all commands normally, no summaries shown
- **Database populated**: Summaries appear in tooltips

The `commands` table is a **cache/enrichment layer**, not the source of truth for what commands exist.

## Spec Documents

Each spec document has universally unique IDs (e.g., **SPEC-DISC-001**) for referencing. Every section links to its test coverage.

| Document | ID Prefix | Description |
|----------|-----------|-------------|
| [Extension Registration](extension.md) | `SPEC-EXT-*` | Activation, commands, views, menus, icons |
| [Command Discovery](discovery.md) | `SPEC-DISC-*` | All 19 discovery types (shell, npm, make, etc.) |
| [Command Execution](execution.md) | `SPEC-EXEC-*` | Run, run in current terminal, debug, cwd handling |
| [Tree View](tree-view.md) | `SPEC-TREE-*` | Click behavior, folder hierarchy, label simplification |
| [Quick Launch](quick-launch.md) | `SPEC-QL-*` | Starring, ordering, duplicate prevention |
| [Tagging](tagging.md) | `SPEC-TAG-*` | Tags, filtering, config sync |
| [Parameterized Commands](parameters.md) | `SPEC-PARAM-*` | Parameter formats, language-specific examples |
| [Settings](settings.md) | `SPEC-SET-*` | Exclude patterns, sort order |
| [Database Schema](database.md) | `SPEC-DB-*` | Tables, implementation, content hashing |
| [AI Summaries](ai-summaries.md) | `SPEC-AI-*` | Processing flow, model selection, verification |
| [Utilities](utilities.md) | `SPEC-UTIL-*` | JSON comment removal, parsing |
| [Command Skills](skills.md) | `SPEC-SKILL-*` | *(not yet implemented)* |

## ID Reference

All spec IDs follow the pattern `SPEC-{AREA}-{NUMBER}`:

### Extension (SPEC-EXT)
- **SPEC-EXT-001** - Extension Registration
- **SPEC-EXT-010** - Activation
- **SPEC-EXT-020** - Command Registration
- **SPEC-EXT-030** - Tree View Registration
- **SPEC-EXT-040** - Menu Contributions
- **SPEC-EXT-050** - Command Icons
- **SPEC-EXT-060** - Package Configuration
- **SPEC-EXT-070** - Workspace Trust

### Discovery (SPEC-DISC)
- **SPEC-DISC-001** - Command Discovery
- **SPEC-DISC-010** - Shell Scripts
- **SPEC-DISC-020** - NPM Scripts
- **SPEC-DISC-030** - Makefile Targets
- **SPEC-DISC-040** - Launch Configurations
- **SPEC-DISC-050** - VS Code Tasks
- **SPEC-DISC-060** - Python Scripts
- **SPEC-DISC-070** - .NET Projects
- **SPEC-DISC-080** - PowerShell and Batch Scripts
- **SPEC-DISC-090** - Gradle Tasks
- **SPEC-DISC-100** - Cargo Tasks
- **SPEC-DISC-110** - Maven Goals
- **SPEC-DISC-120** - Ant Targets
- **SPEC-DISC-130** - Just Recipes
- **SPEC-DISC-140** - Taskfile Tasks
- **SPEC-DISC-150** - Deno Tasks
- **SPEC-DISC-160** - Rake Tasks
- **SPEC-DISC-170** - Composer Scripts
- **SPEC-DISC-180** - Docker Compose Services
- **SPEC-DISC-190** - Markdown Files

### Execution (SPEC-EXEC)
- **SPEC-EXEC-001** - Command Execution
- **SPEC-EXEC-010** - Run in New Terminal
- **SPEC-EXEC-020** - Run in Current Terminal
- **SPEC-EXEC-030** - Debug
- **SPEC-EXEC-031** - Setting Up Debugging
- **SPEC-EXEC-032** - Language-Specific Debug Examples
- **SPEC-EXEC-040** - Working Directory Handling
- **SPEC-EXEC-050** - Terminal Management
- **SPEC-EXEC-060** - Error Handling

### Tree View (SPEC-TREE)
- **SPEC-TREE-001** - Tree View
- **SPEC-TREE-010** - Click Behavior
- **SPEC-TREE-020** - Folder Hierarchy
- **SPEC-TREE-030** - Folder Grouping
- **SPEC-TREE-040** - Directory Label Simplification

### Quick Launch (SPEC-QL)
- **SPEC-QL-001** - Quick Launch
- **SPEC-QL-010** - Adding to Quick Launch
- **SPEC-QL-020** - Removing from Quick Launch
- **SPEC-QL-030** - Display Order
- **SPEC-QL-040** - Duplicate Prevention
- **SPEC-QL-050** - Empty State

### Tagging (SPEC-TAG)
- **SPEC-TAG-001** - Tagging
- **SPEC-TAG-010** - Command ID Format
- **SPEC-TAG-020** - How Tagging Works
- **SPEC-TAG-030** - Database Operations
- **SPEC-TAG-040** - Managing Tags
- **SPEC-TAG-050** - Tag Filter
- **SPEC-TAG-060** - Clear Filter
- **SPEC-TAG-070** - Tag Config Sync

### Parameters (SPEC-PARAM)
- **SPEC-PARAM-001** - Parameterized Commands
- **SPEC-PARAM-010** - Parameter Definition
- **SPEC-PARAM-020** - Parameter Formats
- **SPEC-PARAM-030** - Language-Specific Examples
- **SPEC-PARAM-040** - VS Code Tasks

### Settings (SPEC-SET)
- **SPEC-SET-001** - Settings
- **SPEC-SET-010** - Exclude Patterns
- **SPEC-SET-020** - Sort Order
- **SPEC-SET-030** - Configuration Reading

### Database (SPEC-DB)
- **SPEC-DB-001** - Database Schema
- **SPEC-DB-010** - Implementation
- **SPEC-DB-020** - Commands Table
- **SPEC-DB-030** - Tags Table
- **SPEC-DB-040** - Command Tags Junction Table
- **SPEC-DB-050** - Content Hashing

### AI Summaries (SPEC-AI)
- **SPEC-AI-001** - AI Summaries
- **SPEC-AI-010** - Automatic Processing Flow
- **SPEC-AI-020** - Summary Generation
- **SPEC-AI-030** - Model Selection
- **SPEC-AI-040** - Verification

### Utilities (SPEC-UTIL)
- **SPEC-UTIL-001** - Utilities
- **SPEC-UTIL-010** - JSON Comment Removal
- **SPEC-UTIL-020** - JSON Parsing

### Skills (SPEC-SKILL)
- **SPEC-SKILL-001** - Command Skills *(not yet implemented)*
- **SPEC-SKILL-010** - Skill File Format
- **SPEC-SKILL-020** - Context Menu Integration
- **SPEC-SKILL-030** - Skill Execution
