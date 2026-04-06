---

# Command Execution

**SPEC-EXEC-001**

Commands can be executed three ways via inline buttons or context menu.

## Run in New Terminal

**SPEC-EXEC-010**

Opens a new VS Code terminal and runs the command. Triggered by the play button or `commandtree.run` command.

### Test Coverage
- [execution.e2e.test.ts](../src/test/e2e/execution.e2e.test.ts): "commandtree.run creates a new terminal", "commandtree.run terminal has descriptive name", "commandtree.run handles undefined gracefully", "commandtree.run handles null task property gracefully"
- [runner.e2e.test.ts](../src/test/e2e/runner.e2e.test.ts): "executes shell task and creates terminal"

## Run in Current Terminal

**SPEC-EXEC-020**

Sends the command to the currently active terminal. Triggered by the circle-play button or `commandtree.runInCurrentTerminal` command.

### Test Coverage
- [execution.e2e.test.ts](../src/test/e2e/execution.e2e.test.ts): "runInCurrentTerminal command is registered", "runInCurrentTerminal creates terminal if none exists", "runInCurrentTerminal uses active terminal if available", "runInCurrentTerminal handles undefined gracefully", "runInCurrentTerminal shows terminal"

## Debug

**SPEC-EXEC-030**

Launch configurations from `.vscode/launch.json` are launched with the VS Code debugger automatically when you run them.

**Debugging Strategy**: CommandTree leverages VS Code's native debugging capabilities through launch configurations rather than implementing custom debug logic for each language.

### Setting Up Debugging

**SPEC-EXEC-031**

To debug projects discovered by CommandTree:

1. **Create Launch Configuration**: Add a `.vscode/launch.json` file to your workspace
2. **Auto-Discovery**: CommandTree automatically discovers and displays all launch configurations
3. **Click to Debug**: Click the debug button next to any launch configuration to start debugging

### Language-Specific Debug Examples

**SPEC-EXEC-032**

**.NET Projects**:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": ".NET Core Launch (console)",
      "type": "coreclr",
      "request": "launch",
      "preLaunchTask": "build",
      "program": "${workspaceFolder}/bin/Debug/net8.0/MyApp.dll",
      "args": [],
      "cwd": "${workspaceFolder}",
      "stopAtEntry": false
    }
  ]
}
```

**Node.js/TypeScript**:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Node",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/dist/index.js",
      "preLaunchTask": "npm: build"
    }
  ]
}
```

**Python**:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: Current File",
      "type": "python",
      "request": "launch",
      "program": "${file}",
      "console": "integratedTerminal"
    }
  ]
}
```

**Note**: VS Code's IntelliSense provides language-specific templates when creating launch.json files.

### Test Coverage
- [execution.e2e.test.ts](../src/test/e2e/execution.e2e.test.ts): "launch tasks use debug API", "active debug sessions can be queried", "launch configurations are defined", "launch task uses debug API", "launch configurations have correct types"

## Working Directory Handling

**SPEC-EXEC-040**

Each task type uses the appropriate working directory:
- Shell tasks: workspace root
- NPM tasks: directory containing the `package.json`
- Make tasks: directory containing the `Makefile`

### Test Coverage
- [execution.e2e.test.ts](../src/test/e2e/execution.e2e.test.ts): "shell tasks use correct cwd", "npm tasks use package.json directory as cwd", "make tasks use Makefile directory as cwd"

## Terminal Management

**SPEC-EXEC-050**

Terminals created by CommandTree have descriptive names. New terminals are created for `run` commands; `runInCurrentTerminal` reuses the active terminal or creates one if none exists.

### Test Coverage
- [execution.e2e.test.ts](../src/test/e2e/execution.e2e.test.ts): "terminals are created for shell tasks", "terminal names are descriptive", "new terminal has CommandTree prefix in name", "terminal execution with cwd sets working directory"

## Error Handling

**SPEC-EXEC-060**

Commands handle graceful failure for undefined/null tasks and user cancellation during parameter collection.

### Test Coverage
- [execution.e2e.test.ts](../src/test/e2e/execution.e2e.test.ts): "run command handles undefined task gracefully", "run command handles null task gracefully", "handles task cancellation gracefully"
