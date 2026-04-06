# Command Discovery

**SPEC-DISC-001**

CommandTree recursively scans the workspace for runnable commands grouped by type. Discovery respects exclude patterns configured in settings. It does this in the background on low priority.

## Parsing Strategy

**[DISC-PARSE-STRATEGY]**

Discovery modules MUST follow this hierarchy for parsing file formats:

1. **VS Code built-in APIs** — Use when VS Code already parses the format natively. These are 100% reliable, handle edge cases (JSONC comments, variable substitution, input prompts), and produce zero maintenance burden. Examples:
   - `vscode.tasks.fetchTasks()` for tasks.json
   - `vscode.workspace.getConfiguration("launch")` for launch.json
   - `JSON.parse()` for standard JSON files (npm, composer, deno)

2. **No parsing** — If the format is simple enough that line-by-line text scanning works (shell comments, Python shebangs, Makefile targets), use that directly. No AST, no state machine.

3. **Never** — Do NOT write ad-hoc parsers for structured formats (YAML, XML, TOML). If VS Code doesn't provide a built-in API and a proper parser library is needed, add one as a dependency.

**Rationale**: Ad-hoc parsing of structured formats creates exponential branch complexity, is impossible to fully test, and silently breaks on valid input the author didn't anticipate. VS Code's built-in parsers are maintained by Microsoft, handle all edge cases, and cost zero lines of code.

## Shell Scripts

**SPEC-DISC-010**

Discovers `.sh` files throughout the workspace. Supports optional `@param` and `@description` comments for metadata.

### Test Coverage
- [discovery.e2e.test.ts](../src/test/e2e/discovery.e2e.test.ts): "discovers shell scripts in workspace", "parses @param comments from shell scripts", "extracts description from first comment line"

## NPM Scripts

**SPEC-DISC-020**

Reads `scripts` from all `package.json` files, including nested projects and subfolders.

### Test Coverage
- [discovery.e2e.test.ts](../src/test/e2e/discovery.e2e.test.ts): "discovers npm scripts from root package.json", "discovers npm scripts from subproject package.json"

## Makefile Targets

**SPEC-DISC-030**

Parses `Makefile` and `makefile` for named targets.

### Test Coverage
- [discovery.e2e.test.ts](../src/test/e2e/discovery.e2e.test.ts): "discovers Makefile targets", "skips internal targets starting with dot"

## Launch Configurations

**SPEC-DISC-040**

Reads debug configurations from `.vscode/launch.json`.

### Test Coverage
- [discovery.e2e.test.ts](../src/test/e2e/discovery.e2e.test.ts): "discovers launch configurations from launch.json", "handles JSONC comments in launch.json"

## VS Code Tasks

**SPEC-DISC-050**

Reads task definitions from `.vscode/tasks.json`, including support for `${input:*}` variable prompts.

### Test Coverage
- [discovery.e2e.test.ts](../src/test/e2e/discovery.e2e.test.ts): "discovers tasks from tasks.json", "parses input definitions from tasks.json", "handles JSONC comments in tasks.json"

## Python Scripts

**SPEC-DISC-060**

Discovers files with a `.py` extension.

### Test Coverage
- [discovery.e2e.test.ts](../src/test/e2e/discovery.e2e.test.ts): "discovers Python scripts with shebang", "discovers Python scripts with __main__ block", "parses @param comments from Python scripts", "excludes non-runnable Python files"

## .NET Projects

**SPEC-DISC-070**

Discovers .NET projects (`.csproj`, `.fsproj`) and automatically creates tasks based on project type:

- **All projects**: `build`, `clean`
- **Test projects** (containing `Microsoft.NET.Test.Sdk` or test frameworks): `test` with optional filter parameter
- **Executable projects** (OutputType = Exe/WinExe): `run` with optional runtime arguments

**Parameter Support**:
- `dotnet run`: Accepts runtime arguments passed after `--` separator
- `dotnet test`: Accepts `--filter` expression for selective test execution

**Debugging**: Use VS Code's built-in .NET debugging by creating launch configurations in `.vscode/launch.json`. These are automatically discovered via Launch Configuration discovery.

### Test Coverage
- [discovery.e2e.test.ts](../src/test/e2e/discovery.e2e.test.ts): "discovers .csproj files with executable and test projects", "discovers test projects with Microsoft.NET.Test.Sdk"

## PowerShell and Batch Scripts

**SPEC-DISC-080**

Discovers PowerShell scripts (`.ps1`) and Batch/CMD scripts (`.bat`, `.cmd`).

### Test Coverage
- [discovery.e2e.test.ts](../src/test/e2e/discovery.e2e.test.ts): "discovers PowerShell scripts", "discovers Batch scripts", "discovers CMD scripts"

## Gradle Tasks

**SPEC-DISC-090**

Discovers Gradle tasks from `build.gradle` files.

### Test Coverage
- [discovery.e2e.test.ts](../src/test/e2e/discovery.e2e.test.ts): "discovers Gradle tasks from build.gradle"

## Cargo Tasks

**SPEC-DISC-100**

Discovers Cargo (Rust) projects from `Cargo.toml` files.

### Test Coverage
- [discovery.e2e.test.ts](../src/test/e2e/discovery.e2e.test.ts): "discovers Cargo.toml files"

## Maven Goals

**SPEC-DISC-110**

Discovers Maven projects from `pom.xml` files.

### Test Coverage
- [discovery.e2e.test.ts](../src/test/e2e/discovery.e2e.test.ts): "discovers pom.xml files"

## Ant Targets

**SPEC-DISC-120**

Discovers Ant build targets from `build.xml` files.

### Test Coverage
- [discovery.e2e.test.ts](../src/test/e2e/discovery.e2e.test.ts): "discovers build.xml files"

## Just Recipes

**SPEC-DISC-130**

Discovers Just recipes from `justfile`.

### Test Coverage
- [discovery.e2e.test.ts](../src/test/e2e/discovery.e2e.test.ts): "discovers justfile recipes"

## Taskfile Tasks

**SPEC-DISC-140**

Discovers tasks from `Taskfile.yml`.

### Test Coverage
- [discovery.e2e.test.ts](../src/test/e2e/discovery.e2e.test.ts): "discovers Taskfile.yml tasks"

## Deno Tasks

**SPEC-DISC-150**

Discovers Deno tasks from `deno.json`.

### Test Coverage
- [discovery.e2e.test.ts](../src/test/e2e/discovery.e2e.test.ts): "discovers deno.json tasks"

## Rake Tasks

**SPEC-DISC-160**

Discovers Rake tasks from `Rakefile`.

### Test Coverage
- [discovery.e2e.test.ts](../src/test/e2e/discovery.e2e.test.ts): "discovers Rakefile tasks"

## Composer Scripts

**SPEC-DISC-170**

Discovers Composer scripts from `composer.json`.

### Test Coverage
- [discovery.e2e.test.ts](../src/test/e2e/discovery.e2e.test.ts): "discovers composer.json scripts"

## Docker Compose Services

**SPEC-DISC-180**

Discovers Docker Compose services from `docker-compose.yml`.

### Test Coverage
- [discovery.e2e.test.ts](../src/test/e2e/discovery.e2e.test.ts): "discovers docker-compose.yml services"

## Markdown Files

**SPEC-DISC-190**

Discovers markdown files (`.md`) in the workspace and presents them in the tree view. Running a markdown item opens a preview instead of a terminal.

### Test Coverage
- [markdown.e2e.test.ts](../src/test/e2e/markdown.e2e.test.ts): "discovers markdown files in workspace root", "discovers markdown files in subdirectories", "extracts description from markdown heading", "sets correct file path for markdown items"
- [markdown.e2e.test.ts](../src/test/e2e/markdown.e2e.test.ts): "openPreview command is registered", "openPreview command opens markdown preview", "run command on markdown item opens preview"
- [markdown.e2e.test.ts](../src/test/e2e/markdown.e2e.test.ts): "markdown items have correct context value", "markdown items display with correct icon"
