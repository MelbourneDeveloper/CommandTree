import * as assert from "assert";
import * as path from "path";
import { simplifyPath, generateCommandId, isPrivateTask, isCommandItem } from "../../models/taskHelpers";
import type { CommandItem, CommandType } from "../../models/TaskItem";

const WORKSPACE = path.join(path.sep, "ws");

function taskAt(relative: string, type: CommandType, label: string): CommandItem {
  const filePath = path.join(WORKSPACE, relative);
  return {
    id: generateCommandId(type, filePath, label),
    label,
    type,
    category: simplifyPath(filePath, WORKSPACE),
    command: label,
    filePath,
    tags: [],
  };
}

suite("TaskItem simplifyPath Unit Tests", () => {
  test("returns 'Root' when file is at workspace root", () => {
    assert.strictEqual(simplifyPath(path.join(WORKSPACE, "Makefile"), WORKSPACE), "Root");
  });

  test("returns single folder name for a direct child directory", () => {
    assert.strictEqual(simplifyPath(path.join(WORKSPACE, "scripts", "build.sh"), WORKSPACE), "scripts");
  });

  test("returns full relative path for shallow nesting (<= 3 levels)", () => {
    const filePath = path.join(WORKSPACE, "a", "b", "c", "file.sh");
    const expected = ["a", "b", "c"].join("/");
    assert.strictEqual(simplifyPath(filePath, WORKSPACE), expected);
  });

  test("collapses deep nesting (> 3 levels) to first/.../last", () => {
    const filePath = path.join(WORKSPACE, "top", "mid1", "mid2", "deep", "file.sh");
    assert.strictEqual(simplifyPath(filePath, WORKSPACE), "top/.../deep");
  });

  test("collapses very deep nesting to first/.../last", () => {
    const filePath = path.join(WORKSPACE, "a", "b", "c", "d", "e", "f", "file.sh");
    assert.strictEqual(simplifyPath(filePath, WORKSPACE), "a/.../f");
  });
});

suite("TaskItem generateCommandId Unit Tests", () => {
  test("returns type:path:name format", () => {
    assert.strictEqual(generateCommandId("shell", "/x/y.sh", "build"), "shell:/x/y.sh:build");
  });

  test("distinct names produce distinct IDs for same file", () => {
    const a = generateCommandId("make", "/x/Makefile", "build");
    const b = generateCommandId("make", "/x/Makefile", "test");
    assert.notStrictEqual(a, b);
  });
});

suite("TaskItem isPrivateTask Unit Tests", () => {
  test("make task with _ prefix is private", () => {
    assert.strictEqual(isPrivateTask(taskAt("Makefile", "make", "_hidden")), true);
  });

  test("mise task with _ prefix is private", () => {
    assert.strictEqual(isPrivateTask(taskAt("mise.toml", "mise", "_hidden")), true);
  });

  test("make task without _ prefix is not private", () => {
    assert.strictEqual(isPrivateTask(taskAt("Makefile", "make", "build")), false);
  });

  test("shell task with _ prefix is not private (type does not support it)", () => {
    assert.strictEqual(isPrivateTask(taskAt("scripts/_hidden.sh", "shell", "_hidden.sh")), false);
  });

  test("npm task with _ prefix is not private (type does not support it)", () => {
    assert.strictEqual(isPrivateTask(taskAt("package.json", "npm", "_hidden")), false);
  });
});

suite("TaskItem isCommandItem Unit Tests", () => {
  test("null is not a command item", () => {
    assert.strictEqual(isCommandItem(null), false);
  });

  test("undefined is not a command item", () => {
    assert.strictEqual(isCommandItem(undefined), false);
  });

  test("category node is not a command item", () => {
    assert.strictEqual(isCommandItem({ nodeType: "category", commandType: "make" }), false);
  });

  test("folder node is not a command item", () => {
    assert.strictEqual(isCommandItem({ nodeType: "folder" }), false);
  });

  test("task is a command item", () => {
    assert.strictEqual(isCommandItem(taskAt("Makefile", "make", "build")), true);
  });
});
