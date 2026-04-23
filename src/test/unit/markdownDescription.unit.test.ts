import * as assert from "assert";
import { extractDescription } from "../../discovery/parsers/markdownParser";

const LONG_TEXT = "a".repeat(200);

suite("Markdown extractDescription Unit Tests", () => {
  test("returns undefined for empty content", () => {
    assert.strictEqual(extractDescription(""), undefined);
  });

  test("returns undefined for whitespace-only content", () => {
    assert.strictEqual(extractDescription("\n\n   \n"), undefined);
  });

  test("returns heading text stripped of # markers", () => {
    assert.strictEqual(extractDescription("# My Title\n\nbody"), "My Title");
  });

  test("returns heading with multiple # markers stripped", () => {
    assert.strictEqual(extractDescription("### Deep Heading\n"), "Deep Heading");
  });

  test("skips empty heading line and falls through to paragraph", () => {
    assert.strictEqual(extractDescription("#\nfirst paragraph\n"), "first paragraph");
  });

  test("returns first paragraph when there is no heading", () => {
    assert.strictEqual(extractDescription("plain intro line\nmore\n"), "plain intro line");
  });

  test("skips leading blank lines before paragraph", () => {
    assert.strictEqual(extractDescription("\n\n\nintro\n"), "intro");
  });

  test("skips lines that start with a fenced code block marker", () => {
    assert.strictEqual(extractDescription("```\nfoo"), "foo");
  });

  test("returns undefined when every line starts with a fence marker", () => {
    assert.strictEqual(extractDescription("```\n```\n```"), undefined);
  });

  test("skips lines that start with a front matter divider", () => {
    assert.strictEqual(extractDescription("---\ntitle: x"), "title: x");
  });

  test("returns undefined when every line starts with a divider", () => {
    assert.strictEqual(extractDescription("---\n---\n---"), undefined);
  });

  test("truncates long headings and appends ellipsis", () => {
    const result = extractDescription(`# ${LONG_TEXT}\n`);
    assert.ok(result !== undefined);
    assert.strictEqual(result.length, 153);
    assert.ok(result.endsWith("..."));
  });

  test("truncates long paragraphs and appends ellipsis", () => {
    const result = extractDescription(`${LONG_TEXT}\n`);
    assert.ok(result !== undefined);
    assert.strictEqual(result.length, 153);
    assert.ok(result.endsWith("..."));
  });

  test("short paragraph is returned as-is without truncation", () => {
    assert.strictEqual(extractDescription("short\n"), "short");
  });
});
