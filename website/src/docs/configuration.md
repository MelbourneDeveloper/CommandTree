---
layout: layouts/docs.njk
title: Configuration
eleventyNavigation:
  key: Configuration
  order: 5
---

# Configuration

All settings via VS Code settings (`Cmd+,` / `Ctrl+,`).

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `commandtree.enableAiSummaries` | Use GitHub Copilot to generate plain-language summaries | `true` |
| `commandtree.excludePatterns` | Glob patterns to exclude from discovery | `**/node_modules/**`, `**/.git/**`, etc. |
| `commandtree.sortOrder` | Sort commands by `folder`, `name`, or `type` | `folder` |

## Quick Launch

Pin commands by clicking the star icon. Pinned commands appear in a dedicated panel at the top of the tree.

## Tagging

Right-click any command and choose **Add Tag** to assign a tag. Tags are stored locally in the workspace database and can be used to filter the tree. Remove tags the same way via **Remove Tag**.

## Filtering

| Command | Description |
|---------|-------------|
| `commandtree.filter` | Text filter input |
| `commandtree.filterByTag` | Tag filter picker |
| `commandtree.clearFilter` | Clear all filters |
