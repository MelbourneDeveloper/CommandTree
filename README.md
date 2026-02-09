# CommandTree

**One sidebar. Every command. AI-powered.**

**[commandtree.dev](https://commandtree.dev/)**

<p align="center">
  <img src="website/src/assets/images/CommandTree.gif" alt="CommandTree in action" width="780">
</p>

CommandTree scans your project and surfaces all runnable commands across 19 tool types in a single tree view. Filter by text or tag, search by meaning with AI-powered semantic search, and run in terminal or debugger.

## AI Summaries (powered by GitHub Copilot)

When [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) is installed, CommandTree automatically generates plain-language summaries of every discovered command. Hover over any command to see what it does, without reading the script. Commands that perform dangerous operations (like `rm -rf` or force-push) are flagged with a security warning.

Summaries are stored locally and only regenerate when the underlying script changes.

## Features

- **AI Summaries** - GitHub Copilot describes each command in plain language, with security warnings for dangerous operations
- **AI-Powered Search** - Find commands by meaning, not just name — local embeddings, no data leaves your machine
- **Auto-discovery** - 19 command types including shell scripts, npm, Make, Python, PowerShell, Gradle, Cargo, Maven, Docker Compose, .NET, and more
- **Quick Launch** - Pin frequently-used commands to a dedicated panel at the top
- **Tagging** - Right-click any command to add or remove tags
- **Filtering** - Filter the tree by text search or by tag
- **Run anywhere** - Execute in a new terminal, the current terminal, or launch with the debugger
- **Folder grouping** - Commands grouped by directory with collapsible nested hierarchy
- **Parameterized commands** - Prompt for arguments before execution
- **File watching** - Automatic refresh when scripts or config files change

## Supported Command Types

| Type | Source |
|------|--------|
| Shell Scripts | `.sh`, `.bash`, `.zsh` files |
| NPM Scripts | `package.json` scripts |
| Makefile Targets | `Makefile` / `makefile` targets |
| VS Code Tasks | `.vscode/tasks.json` |
| Launch Configs | `.vscode/launch.json` |
| Python Scripts | `.py` files |
| PowerShell Scripts | `.ps1` files |
| Gradle Tasks | `build.gradle`, `build.gradle.kts` |
| Cargo Tasks | `Cargo.toml` (Rust) |
| Maven Goals | `pom.xml` |
| Ant Targets | `build.xml` |
| Just Recipes | `justfile` |
| Taskfile Tasks | `Taskfile.yml` |
| Deno Tasks | `deno.json`, `deno.jsonc` |
| Rake Tasks | `Rakefile` (Ruby) |
| Composer Scripts | `composer.json` (PHP) |
| Docker Compose | `docker-compose.yml` |
| .NET Projects | `.csproj`, `.fsproj` |
| Markdown Files | `.md` files |

## Getting Started

Install from the VS Code Marketplace, or from source:

```bash
npm install
npm run package
code --install-extension commandtree-*.vsix
```

Open a workspace and the CommandTree panel appears in the sidebar. All discovered commands are listed by category.

## Usage

- **Run a command** - Click the play button or right-click > "Run Command"
- **Run in current terminal** - Right-click > "Run in Current Terminal"
- **Debug** - Launch configurations run with the VS Code debugger
- **Star a command** - Click the star icon to pin it to Quick Launch
- **Filter** - Use the toolbar icons to filter by text or tag
- **Tag commands** - Right-click > "Add Tag" to group related commands

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `commandtree.enableAiSummaries` | Copilot-powered plain-language summaries and security warnings | `true` |
| `commandtree.excludePatterns` | Glob patterns to exclude from discovery | `**/node_modules/**`, `**/.git/**`, etc. |
| `commandtree.sortOrder` | Sort commands by `folder`, `name`, or `type` | `folder` |

## License

[MIT](LICENSE)
