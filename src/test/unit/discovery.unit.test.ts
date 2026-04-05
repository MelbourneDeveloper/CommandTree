import * as assert from "assert";
import {
  parsePowerShellParams,
  parsePowerShellDescription,
  parseBatchDescription,
} from "../../discovery/parsers/powershellParser";
import { parseMiseToml, parseMiseYaml } from "../../discovery/parsers/miseParser";

interface ParsedParam {
  name: string;
  description?: string;
  default?: string;
}

function paramAt(params: readonly ParsedParam[], index: number): ParsedParam {
  const p = params[index];
  assert.ok(p !== undefined, `Expected param at index ${index}`);
  return p;
}

suite("PowerShell Parser Unit Tests", () => {
  suite("parsePowerShellParams", () => {
    test("extracts @param comments", () => {
      const content = [
        "# @param config The configuration file",
        "# @param verbose Enable verbose output",
        "param($config, $verbose)",
      ].join("\n");
      const params = parsePowerShellParams(content);
      assert.strictEqual(params.length, 2);
      assert.strictEqual(paramAt(params, 0).name, "config");
      assert.strictEqual(paramAt(params, 0).description, "The configuration file");
      assert.strictEqual(paramAt(params, 1).name, "verbose");
      assert.strictEqual(paramAt(params, 1).description, "Enable verbose output");
    });

    test("extracts default values from @param comments", () => {
      const content = "# @param env The environment (default: dev)\nparam($env)";
      const params = parsePowerShellParams(content);
      assert.strictEqual(params.length, 1);
      assert.strictEqual(paramAt(params, 0).name, "env");
      assert.strictEqual(paramAt(params, 0).default, "dev");
    });

    test("extracts param block variables not covered by comments", () => {
      const content = "param($Alpha, $Beta, $Gamma)";
      const params = parsePowerShellParams(content);
      assert.strictEqual(params.length, 3);
      assert.strictEqual(paramAt(params, 0).name, "Alpha");
      assert.strictEqual(paramAt(params, 1).name, "Beta");
      assert.strictEqual(paramAt(params, 2).name, "Gamma");
    });

    test("comment params and param block vars merge without duplicates", () => {
      const content = "param($config, $verbose)\n# @param config Config file";
      const params = parsePowerShellParams(content);
      assert.strictEqual(params.length, 2);
      assert.strictEqual(paramAt(params, 0).name, "config");
      assert.strictEqual(paramAt(params, 0).description, "Config file");
      assert.strictEqual(paramAt(params, 1).name, "verbose");
    });

    test("returns empty for no params", () => {
      const content = "Write-Host 'Hello World'";
      const params = parsePowerShellParams(content);
      assert.strictEqual(params.length, 0);
    });

    test("handles @param with no description", () => {
      const content = "# @param config\nparam($config)";
      const params = parsePowerShellParams(content);
      assert.strictEqual(params.length, 1);
      assert.strictEqual(paramAt(params, 0).name, "config");
    });

    test("handles param block without opening paren", () => {
      const content = "# This is just a comment about params\nparam\n$foo = 1";
      const params = parsePowerShellParams(content);
      assert.strictEqual(params.length, 0);
    });

    test("handles empty @param tag by skipping it", () => {
      const content = "# @param \nWrite-Host 'hello'";
      const params = parsePowerShellParams(content);
      assert.strictEqual(params.length, 0);
    });
  });

  suite("parsePowerShellDescription", () => {
    test("extracts description from single-line comment", () => {
      const content = "# This script does something\nparam($x)";
      const desc = parsePowerShellDescription(content);
      assert.strictEqual(desc, "This script does something");
    });

    test("extracts description from block comment", () => {
      const content = "<#\n.SYNOPSIS\nDoes great things\n#>\nparam($x)";
      const desc = parsePowerShellDescription(content);
      assert.strictEqual(desc, "Does great things");
    });

    test("extracts inline block comment description", () => {
      const content = "<# Build automation script #>\nparam($x)";
      const desc = parsePowerShellDescription(content);
      assert.strictEqual(desc, "Build automation script");
    });

    test("returns undefined for empty content", () => {
      const desc = parsePowerShellDescription("");
      assert.strictEqual(desc, undefined);
    });

    test("skips @ and . prefixed comments", () => {
      const content = "# @param foo\n# .SYNOPSIS\n# Actual description";
      const desc = parsePowerShellDescription(content);
      assert.strictEqual(desc, "Actual description");
    });

    test("returns undefined when no description found", () => {
      const content = "param($x)\nWrite-Host 'hello'";
      const desc = parsePowerShellDescription(content);
      assert.strictEqual(desc, undefined);
    });

    test("handles block comment with .SYNOPSIS then description", () => {
      const content = "<#\n.SYNOPSIS\nMy great script\n#>";
      const desc = parsePowerShellDescription(content);
      assert.strictEqual(desc, "My great script");
    });

    test("handles empty block comment", () => {
      const content = "<#\n#>";
      const desc = parsePowerShellDescription(content);
      assert.strictEqual(desc, undefined);
    });
  });

  suite("parseMiseToml", () => {
    test("parses tasks without [tasks] preamble", () => {
      const content = [
        "[tools]",
        'go = "latest"',
        "",
        "[tasks.lint]",
        'run = "golangci-lint run --fix"',
        "",
        "[tasks.test]",
        'run = "gotestsum --rerun-fails"',
      ].join("\n");
      const tasks = parseMiseToml(content);
      assert.strictEqual(tasks.length, 2);
      assert.strictEqual(tasks[0]?.name, "lint");
      assert.strictEqual(tasks[1]?.name, "test");
    });

    test("parses tasks with [tasks] preamble", () => {
      const content = ["[tasks]", "[tasks.build]", 'run = "cargo build"'].join("\n");
      const tasks = parseMiseToml(content);
      assert.strictEqual(tasks.length, 1);
      assert.strictEqual(tasks[0]?.name, "build");
    });

    test("extracts description", () => {
      const content = ["[tasks.deploy]", 'description = "Deploy to production"', 'run = "deploy.sh"'].join("\n");
      const tasks = parseMiseToml(content);
      assert.strictEqual(tasks.length, 1);
      assert.strictEqual(tasks[0]?.description, "Deploy to production");
    });

    test("handles non-task sections interspersed", () => {
      const content = [
        "[tasks.format]",
        'run = "go fmt ./..."',
        "",
        "[env]",
        'FOO = "bar"',
        "",
        "[tasks.build]",
        'run = "go build ."',
      ].join("\n");
      const tasks = parseMiseToml(content);
      assert.strictEqual(tasks.length, 2);
      assert.strictEqual(tasks[0]?.name, "format");
      assert.strictEqual(tasks[1]?.name, "build");
    });

    test("returns empty for no tasks", () => {
      const content = ["[tools]", 'go = "latest"'].join("\n");
      const tasks = parseMiseToml(content);
      assert.strictEqual(tasks.length, 0);
    });
  });

  suite("parseMiseYaml", () => {
    test("parses task names under tasks key", () => {
      const content = ["tasks:", "  lint:", "    run: golangci-lint run", "  test:", "    run: gotestsum"].join("\n");
      const tasks = parseMiseYaml(content);
      assert.strictEqual(tasks.length, 2);
      assert.strictEqual(tasks[0]?.name, "lint");
      assert.strictEqual(tasks[1]?.name, "test");
    });

    test("extracts description", () => {
      const content = ["tasks:", "  deploy:", '    description: "Deploy to prod"', "    run: deploy.sh"].join("\n");
      const tasks = parseMiseYaml(content);
      assert.strictEqual(tasks.length, 1);
      assert.strictEqual(tasks[0]?.description, "Deploy to prod");
    });

    test("returns empty for no tasks", () => {
      const content = ["tools:", "  go: latest"].join("\n");
      const tasks = parseMiseYaml(content);
      assert.strictEqual(tasks.length, 0);
    });
  });

  suite("parseBatchDescription", () => {
    test("extracts REM comment description", () => {
      const content = "@echo off\nREM Deploy the application\necho deploying";
      const desc = parseBatchDescription(content);
      assert.strictEqual(desc, "Deploy the application");
    });

    test("extracts :: comment description", () => {
      const content = "@echo off\n:: Run all tests\necho testing";
      const desc = parseBatchDescription(content);
      assert.strictEqual(desc, "Run all tests");
    });

    test("skips empty lines and @echo off", () => {
      const content = "\n\n@echo off\n\nREM Build script\n";
      const desc = parseBatchDescription(content);
      assert.strictEqual(desc, "Build script");
    });

    test("returns undefined for empty content", () => {
      const desc = parseBatchDescription("");
      assert.strictEqual(desc, undefined);
    });

    test("returns undefined when no comment found", () => {
      const content = "@echo off\nset FOO=bar";
      const desc = parseBatchDescription(content);
      assert.strictEqual(desc, undefined);
    });

    test("returns undefined for empty REM comment", () => {
      const content = "REM \necho hello";
      const desc = parseBatchDescription(content);
      assert.strictEqual(desc, undefined);
    });

    test("returns undefined for empty :: comment", () => {
      const content = "::\necho hello";
      const desc = parseBatchDescription(content);
      assert.strictEqual(desc, undefined);
    });
  });
});
