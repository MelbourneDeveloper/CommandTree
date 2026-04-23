---
layout: layouts/blog.njk
title: Run Mise Tasks From the VS Code Sidebar - CommandTree 0.9.0
description: CommandTree 0.9.0 discovers mise tasks from mise.toml, .mise.toml, and mise.yaml, then runs them from the VS Code sidebar beside npm, Make, and Just.
date: 2026-04-06
author: Christian Findlay
tags:
  - mise
  - VS Code extension
  - monorepo
excerpt: CommandTree 0.9.0 discovers mise tasks from every mise.toml and mise.yaml in your workspace and runs them from the VS Code sidebar - alongside npm, Make, Just, and 18 other command types.
---

You moved your project to [mise](https://mise.jdx.dev/tasks/) for tool versions and tasks. Now every script lives in `mise.toml`. Great — until you need to run one and you are back to typing `mise tasks`, scrolling, copying a name, and hoping you spelt it right.

**CommandTree 0.9.0 puts every mise task in the VS Code sidebar.** One click to run.

## Every Mise File, Auto-Discovered

Open any workspace and CommandTree finds your mise tasks automatically. All four config formats are supported:

- `mise.toml`
- `.mise.toml`
- `mise.yaml`
- `.mise.yaml`

Both TOML tasks (`[tasks.build]` sections) and YAML task maps work. Descriptions are pulled through and shown as tooltips, so you know what each task does before you run it.

> ```toml
> [tasks.build]
> description = "Compile the CLI in release mode"
> run = "cargo build --release"
> ```
>
> Appears in the tree as **build**, with the description on hover.

## One Click to Run

Click any mise task and CommandTree opens a new terminal in the same directory as the `mise.toml` file and runs `mise run <task>`, matching the command format in the [mise task runner documentation](https://mise.jdx.dev/tasks/). Tasks with parameters get prompted for input before they run.

## Mise *And* Everything Else

Projects often keep more than one task system around: a `Makefile` from before the migration, an `npm run lint` script in `package.json`, shell scripts in `scripts/`, or a `Justfile` for the deploy step.

CommandTree discovers **22 command types** and shows them in one tree:

mise tasks, npm scripts, Makefile targets, Just recipes, Taskfile, shell scripts, Python scripts, PowerShell, Cargo, Gradle, Maven, Ant, Deno, Rake, Composer, Docker Compose services, .NET projects, C# scripts, F# scripts, VS Code tasks, launch configs, and Markdown files.

Filter by tag, pin favourites, and search by text across every command type at once.

## Hover to See What a Task Does

With [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) installed, CommandTree reads the `run` body of each mise task and generates a plain-language summary on hover. Dangerous operations get a security warning indicator. Read more in [AI Summaries on Hover](/blog/ai-summaries-hover/).

## Monorepo-Friendly

Got a monorepo with a `mise.toml` in every package? CommandTree picks them all up. Each task runs in its own package directory, so relative paths and per-package tool versions just work. No configuration, no glob lists.

## Get Started

Install [CommandTree from the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nimblesite.commandtree), open a workspace with a `mise.toml`, and the **Mise Tasks** category appears in the sidebar. That's it.

```bash
code --install-extension nimblesite.commandtree
```

For the full feature list see the [CommandTree docs](/docs/), and for everything mise tasks can do see the [mise tasks documentation](https://mise.jdx.dev/tasks/).
