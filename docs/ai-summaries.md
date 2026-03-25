# AI Summaries

**SPEC-AI-001**

CommandTree **enriches** the tree view with AI-generated summaries. This is an **optional enhancement layer** - all core functionality (running commands, tagging, filtering) works without it.

**What happens when database is populated:**
- AI summaries appear in command tooltips
- Background processing automatically keeps summaries up-to-date

**What happens when database is empty:**
- Tree view still displays all commands discovered from filesystem
- Commands can still be run, tagged, and filtered by tag

This is a **fully automated background process** that requires no user intervention once enabled.

## Automatic Processing Flow

**SPEC-AI-010**

**CRITICAL: This processing MUST happen automatically for EVERY discovered command:**

1. **Discovery**: Command is discovered (shell script, npm script, etc.)
2. **Summary Generation**: GitHub Copilot generates a plain-language summary (1-3 sentences)
3. **Summary Storage**: Summary is stored in the `commands` table in SQLite
4. **Hash Storage**: Content hash is stored for change detection

**Triggers**:
- Initial scan: Process all commands when extension activates
- File watch: Re-process when command files change (debounced 2000ms)
- Never block the UI: All processing runs asynchronously in background

### Test Coverage
- [aisummaries.e2e.test.ts](../src/test/e2e/aisummaries.e2e.test.ts): "generateSummaries command is registered", "generateSummaries produces actual summaries on tasks"

## Summary Generation

**SPEC-AI-020**

- **LLM**: GitHub Copilot via `vscode.lm` API (stable since VS Code 1.90)
- **Input**: Command content (script code, npm script definition, etc.)
- **Output**: Structured result via Language Model Tool API (`summary` + `securityWarning`)
- **Tool Mode**: `LanguageModelChatToolMode.Required` — forces structured output, no text parsing
- **Storage**: `commands.summary` and `commands.security_warning` columns in SQLite
- **Display**: Summary in tooltip on hover. Security warnings shown as warning prefix on tree item label + warning section in tooltip
- **Requirement**: GitHub Copilot installed and authenticated

### Test Coverage
- [aisummaries.e2e.test.ts](../src/test/e2e/aisummaries.e2e.test.ts): "summaries appear in tree item tooltips", "security warnings are surfaced in tree labels"

## Model Selection

**SPEC-AI-030**

Users can select which Copilot model to use for summary generation. The `aiModel` config setting stores the preference. When empty, the user is prompted to pick.

### Test Coverage
- [aisummaries.e2e.test.ts](../src/test/e2e/aisummaries.e2e.test.ts): "selectModel command is registered", "Copilot models are available", "multiple Copilot models are available for user to pick from", "setting aiModel config selects that model for summarisation", "aiModel config is empty by default so user gets prompted"
- [modelSelection.unit.test.ts](../src/test/unit/modelSelection.unit.test.ts): "returns specific model when preferredId matches", "returns undefined when preferredId not found", "auto picks first non-auto model", "auto falls back to first model if all are auto", "returns undefined for empty model list", "auto with empty list returns undefined", "uses saved model ID when it exists and fetches successfully", "prompts user when no saved ID", "prompts user when saved ID no longer available", "saves the user's choice after prompting", "returns error when user cancels picker", "returns error when no models available", "returns error when no models available after retries"

## Verification

**SPEC-AI-040**

To verify AI features are working:

```bash
sqlite3 .commandtree/commandtree.sqlite3
SELECT command_id, summary FROM commands;
```

**Expected**: Every row has a non-empty `summary`. Row count matches discovered commands.
