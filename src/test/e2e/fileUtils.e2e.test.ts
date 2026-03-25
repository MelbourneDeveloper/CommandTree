import * as assert from "assert";
import { removeJsonComments, parseJson } from "../../utils/fileUtils";

/**
 * Unit tests for fileUtils — edge cases for removeJsonComments and parseJson.
 */
suite("fileUtils Unit Tests", () => {
  suite("removeJsonComments", () => {
    test("removes single-line comments", () => {
      const input = '{"key": "value"} // comment';
      const result = removeJsonComments(input);
      assert.strictEqual(result.trim(), '{"key": "value"}');
    });

    test("removes multi-line comments", () => {
      const input = '{"key": /* block comment */ "value"}';
      const result = removeJsonComments(input);
      assert.strictEqual(result, '{"key":  "value"}');
    });

    test("handles unterminated block comment", () => {
      const input = '{"key": "value"} /* unterminated';
      const result = removeJsonComments(input);
      assert.strictEqual(result.trim(), '{"key": "value"}');
    });

    test("preserves // inside strings", () => {
      const input = '{"url": "https://example.com"}';
      const result = removeJsonComments(input);
      assert.strictEqual(result, '{"url": "https://example.com"}');
    });

    test("preserves /* inside strings", () => {
      const input = '{"pattern": "/* not a comment */"}';
      const result = removeJsonComments(input);
      assert.strictEqual(result, '{"pattern": "/* not a comment */"}');
    });

    test("handles escaped quotes inside strings", () => {
      const input = '{"key": "value with \\"escaped\\" quotes"} // comment';
      const result = removeJsonComments(input);
      assert.strictEqual(result.trim(), '{"key": "value with \\"escaped\\" quotes"}');
    });

    test("handles empty input", () => {
      const result = removeJsonComments("");
      assert.strictEqual(result, "");
    });

    test("handles input with only comments", () => {
      const result = removeJsonComments("// just a comment");
      assert.strictEqual(result.trim(), "");
    });
  });

  suite("parseJson", () => {
    test("parses valid JSON", () => {
      const result = parseJson<{ key: string }>('{"key": "value"}');
      assert.ok(result.ok);
      assert.strictEqual(result.value.key, "value");
    });

    test("returns error for malformed JSON", () => {
      const result = parseJson<unknown>("{invalid json}");
      assert.ok(!result.ok);
      assert.ok(result.error.length > 0);
    });

    test("returns error for empty string", () => {
      const result = parseJson<unknown>("");
      assert.ok(!result.ok);
    });

    test("returns error for truncated JSON", () => {
      const result = parseJson<unknown>('{"key": "val');
      assert.ok(!result.ok);
    });
  });
});
