---
layout: layouts/docs.njk
title: AI Summaries
eleventyNavigation:
  key: AI Summaries
  order: 3
---

# AI Summaries

When [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) is installed, CommandTree uses it to generate a plain-language summary for every discovered command. Hover over any command in the tree to see what it does.

## How It Works

After CommandTree discovers your commands, it sends each script's content to GitHub Copilot and asks for a one-to-two sentence description. These summaries appear in the tooltip when you hover over a command.

Summaries are stored in a local SQLite database at `.commandtree/commandtree.sqlite3` in your workspace root. They persist across sessions and only regenerate when the underlying script changes (detected via content hashing).

## Security Warnings

Copilot also analyses each command for potentially dangerous operations like `rm -rf`, `git push --force`, or credential handling. When a risk is detected, the command's label is prefixed with a warning indicator and the tooltip includes a security warning section.

## Requirements

- [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) extension installed and signed in
- The `commandtree.enableAiSummaries` setting enabled (on by default)

If Copilot is not available, CommandTree works exactly as before — all core features (discovery, running, tagging, filtering) are fully independent of AI summaries.

## Triggering Summaries

Summaries generate automatically on activation and when files change. To manually regenerate, run the **CommandTree: Generate AI Summaries** command from the command palette.
