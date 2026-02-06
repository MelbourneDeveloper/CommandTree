---
layout: layouts/docs.njk
title: Task Execution
eleventyNavigation:
  key: Task Execution
  order: 3
---

# Task Execution

Tasks can be executed three ways via inline buttons or context menu.

## Run in New Terminal

Opens a new VS Code terminal and runs the task. Triggered by the play button or `commandtree.run`.

## Run in Current Terminal

Sends the command to the active terminal. Triggered by the circle-play button or `commandtree.runInCurrentTerminal`.

## Debug

Launches with the VS Code debugger. Only for launch configurations. Triggered by the bug button or `commandtree.debug`.

## Parameterized Tasks

Shell scripts with `@param` comments prompt for input before execution. VS Code tasks with `${input:*}` variables prompt automatically.

## Commands

| Command | Description |
|---------|-------------|
| `commandtree.run` | Run task in new terminal |
| `commandtree.runInCurrentTerminal` | Run in active terminal |
| `commandtree.debug` | Launch with debugger |
| `commandtree.refresh` | Reload all tasks |
