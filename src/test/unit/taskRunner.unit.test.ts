import * as assert from "assert";
import { formatParam, buildCommand } from "../../runners/paramFormatting";

suite("TaskRunner Param Formatting Unit Tests", () => {
  test("positional format wraps value in quotes", () => {
    const result = formatParam({ name: "arg" }, "hello");
    assert.strictEqual(result, '"hello"');
  });

  test("positional is default when format is omitted", () => {
    const result = formatParam({ name: "arg" }, "world");
    assert.strictEqual(result, '"world"');
  });

  test("flag format uses --name by default", () => {
    const result = formatParam({ name: "output", format: "flag" }, "/tmp/out");
    assert.strictEqual(result, '--output "/tmp/out"');
  });

  test("flag format uses custom flag when provided", () => {
    const result = formatParam({ name: "output", format: "flag", flag: "-o" }, "/tmp/out");
    assert.strictEqual(result, '-o "/tmp/out"');
  });

  test("flag-equals format uses --name=value", () => {
    const result = formatParam({ name: "config", format: "flag-equals" }, "prod");
    assert.strictEqual(result, "--config=prod");
  });

  test("flag-equals format uses custom flag", () => {
    const result = formatParam({ name: "config", format: "flag-equals", flag: "-c" }, "prod");
    assert.strictEqual(result, "-c=prod");
  });

  test("dashdash-args format prepends --", () => {
    const result = formatParam({ name: "extra", format: "dashdash-args" }, "--verbose --dry-run");
    assert.strictEqual(result, "-- --verbose --dry-run");
  });

  test("empty value is skipped in buildCommand", () => {
    const result = buildCommand("npm test", [
      { def: { name: "arg1" }, value: "" },
      { def: { name: "arg2" }, value: "hello" },
    ]);
    assert.strictEqual(result, 'npm test "hello"');
  });

  test("buildCommand with no params returns base command", () => {
    const result = buildCommand("make build", []);
    assert.strictEqual(result, "make build");
  });

  test("buildCommand with multiple params joins them", () => {
    const result = buildCommand("deploy", [
      { def: { name: "env", format: "flag" }, value: "prod" },
      { def: { name: "config", format: "flag-equals" }, value: "custom.yml" },
    ]);
    assert.strictEqual(result, 'deploy --env "prod" --config=custom.yml');
  });

  test("buildCommand skips all empty values", () => {
    const result = buildCommand("echo", [
      { def: { name: "a" }, value: "" },
      { def: { name: "b" }, value: "" },
    ]);
    assert.strictEqual(result, "echo");
  });
});
