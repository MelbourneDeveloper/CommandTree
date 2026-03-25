# Utilities

**SPEC-UTIL-001**

Internal utility functions used across the extension.

## JSON Comment Removal

**SPEC-UTIL-010**

The `removeJsonComments` function strips single-line (`//`) and multi-line (`/* */`) comments from JSONC content while preserving comment-like strings inside quoted values.

### Test Coverage
- [fileUtils.e2e.test.ts](../src/test/e2e/fileUtils.e2e.test.ts): "removes single-line comments", "removes multi-line comments", "handles unterminated block comment", "preserves // inside strings", "preserves /* inside strings", "handles escaped quotes inside strings", "handles empty input", "handles input with only comments"

## JSON Parsing

**SPEC-UTIL-020**

The `parseJson` function parses JSON with error handling, returning a `Result` type.

### Test Coverage
- [fileUtils.e2e.test.ts](../src/test/e2e/fileUtils.e2e.test.ts): "parses valid JSON", "returns error for malformed JSON", "returns error for empty string", "returns error for truncated JSON"
