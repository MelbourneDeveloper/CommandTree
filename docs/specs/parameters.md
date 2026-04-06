# Parameterized Commands

**SPEC-PARAM-001**

Commands can accept user input at runtime through a flexible parameter system that adapts to different tool requirements.

## Parameter Definition

**SPEC-PARAM-010**

Parameters are defined during discovery with metadata describing how they should be collected and formatted:

```typescript
{
    name: 'filter',
    description: 'Test filter expression',
    default: '',
    options: ['option1', 'option2'],
    format: 'flag',
    flag: '--filter'
}
```

### Test Coverage
- [execution.e2e.test.ts](../src/test/e2e/execution.e2e.test.ts): "task with params has param definitions", "param with options creates quick pick choices", "param with default value provides placeholder"

## Parameter Formats

**SPEC-PARAM-020**

The `format` field controls how parameter values are inserted into commands:

| Format | Example Input | Example Output | Use Case |
|--------|--------------|----------------|----------|
| `positional` (default) | `value` | `command "value"` | Shell scripts, Python positional args |
| `flag` | `value` | `command --flag "value"` | Named options (npm, dotnet test) |
| `flag-equals` | `value` | `command --flag=value` | Equals-style flags (some CLIs) |
| `dashdash-args` | `arg1 arg2` | `command -- arg1 arg2` | Runtime args (dotnet run, npm run) |

**Empty value behavior**: All formats skip adding anything to the command if the user provides an empty value, making all parameters effectively optional.

### Test Coverage
- [taskRunner.unit.test.ts](../src/test/unit/taskRunner.unit.test.ts): "positional format wraps value in quotes", "positional is default when format is omitted", "flag format uses --name by default", "flag format uses custom flag when provided", "flag-equals format uses --name=value", "flag-equals format uses custom flag", "dashdash-args format prepends --", "empty value is skipped in buildCommand", "buildCommand with no params returns base command", "buildCommand with multiple params joins them", "buildCommand skips all empty values"

## Language-Specific Examples

**SPEC-PARAM-030**

### .NET Projects
```typescript
// dotnet run with runtime arguments
{ name: 'args', format: 'dashdash-args', description: 'Runtime arguments' }
// Result: dotnet run -- arg1 arg2

// dotnet test with filter
{ name: 'filter', format: 'flag', flag: '--filter', description: 'Test filter' }
// Result: dotnet test --filter "FullyQualifiedName~MyTest"
```

### Shell Scripts
```bash
#!/bin/bash
# @param environment Target environment (staging, production)
# @param verbose Enable verbose output (default: false)
```

### Python Scripts
```python
# @param config Config file path
# @param debug Enable debug mode (default: False)
```

### NPM Scripts
For runtime args, use `dashdash-args` format:
```typescript
{ name: 'args', format: 'dashdash-args' }
// Result: npm run start -- --port=3000
```

## VS Code Tasks

**SPEC-PARAM-040**

VS Code tasks using `${input:*}` variables prompt automatically via the built-in input UI. These are handled natively by VS Code's task system.

### Test Coverage
- [execution.e2e.test.ts](../src/test/e2e/execution.e2e.test.ts): "vscode task with inputs has parameter definitions"
