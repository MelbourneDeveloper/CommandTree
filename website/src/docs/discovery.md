---
layout: layouts/docs.njk
title: Task Discovery
eleventyNavigation:
  key: Task Discovery
  order: 2
---

# Task Discovery

CommandTree recursively scans the workspace for runnable tasks grouped by type. Discovery respects exclude patterns and runs in the background.

## Shell Scripts

Discovers `.sh`, `.bash`, and `.zsh` files. Supports `@param` and `@description` comments:

```bash
#!/bin/bash
# @description Deploy to environment
# @param environment Target environment (staging, production)
deploy_to "$1"
```

## NPM Scripts

Reads `scripts` from all `package.json` files, including nested projects. Perfect for monorepos.

## Makefile Targets

Parses `Makefile` and `makefile` for named targets.

## Launch Configurations

Reads debug configurations from `.vscode/launch.json`. Launchable with the VS Code debugger.

## VS Code Tasks

Reads task definitions from `.vscode/tasks.json`, including `${input:*}` variable prompts.

## Python Scripts

Discovers `.py` files and runs them in a terminal.

## File Watching

The tree automatically refreshes when scripts or config files change.
