import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, MutableCommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId, simplifyPath } from "../models/TaskItem";
import { readFile } from "../utils/fileUtils";

export const ICON_DEF: IconDef = {
  icon: "tasklist",
  color: "terminal.ansiCyan",
};
export const CATEGORY_DEF: CategoryDef = {
  type: "taskfile",
  label: "Taskfile",
};

/**
 * Discovers tasks from Taskfile.yml (go-task).
 */
export async function discoverTaskfileTasks(workspaceRoot: string, excludePatterns: string[]): Promise<CommandItem[]> {
  const exclude = `{${excludePatterns.join(",")}}`;
  // Taskfile supports: Taskfile.yml, Taskfile.yaml, taskfile.yml, taskfile.yaml
  const [yml1, yaml1, yml2, yaml2] = await Promise.all([
    vscode.workspace.findFiles("**/Taskfile.yml", exclude),
    vscode.workspace.findFiles("**/Taskfile.yaml", exclude),
    vscode.workspace.findFiles("**/taskfile.yml", exclude),
    vscode.workspace.findFiles("**/taskfile.yaml", exclude),
  ]);
  const allFiles = [...yml1, ...yaml1, ...yml2, ...yaml2];
  const commands: CommandItem[] = [];

  for (const file of allFiles) {
    const result = await readFile(file);
    if (!result.ok) {
      continue; // Skip files we can't read
    }

    const content = result.value;
    const taskfileDir = path.dirname(file.fsPath);
    const category = simplifyPath(file.fsPath, workspaceRoot);
    const parsedTasks = parseTaskfileTasks(content);

    for (const parsedTask of parsedTasks) {
      const task: MutableCommandItem = {
        id: generateCommandId("taskfile", file.fsPath, parsedTask.name),
        label: parsedTask.name,
        type: "taskfile",
        category,
        command: `task ${parsedTask.name}`,
        cwd: taskfileDir,
        filePath: file.fsPath,
        tags: [],
      };
      if (parsedTask.description !== undefined) {
        task.description = parsedTask.description;
      }
      commands.push(task);
    }
  }

  return commands;
}

interface TaskfileTask {
  name: string;
  description?: string;
}

interface ParseState {
  inTasks: boolean;
  sectionIndent: number;
  currentTask: string | undefined;
  taskIndent: number;
}

function leadingSpaces(line: string): number {
  let count = 0;
  while (count < line.length && line[count] === " ") {
    count++;
  }
  return count;
}

function isSkippableLine(trimmed: string): boolean {
  return trimmed === "" || trimmed.startsWith("#");
}

function isLeavingTasksSection(state: ParseState, indent: number, trimmed: string): boolean {
  if (!state.inTasks) {
    return false;
  }
  if (indent > state.sectionIndent) {
    return false;
  }
  if (trimmed.startsWith("-")) {
    return false;
  }
  return trimmed.endsWith(":") && !trimmed.includes(" ");
}

function extractTaskName(trimmed: string): string | undefined {
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx <= 0) {
    return undefined;
  }
  const candidate = trimmed.substring(0, colonIdx);
  const firstChar = candidate[0];
  if (firstChar === undefined || !isValidTaskChar(firstChar)) {
    return undefined;
  }
  const allValid = candidate.split("").every(isTaskBodyChar);
  return allValid ? candidate : undefined;
}

function isValidTaskChar(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

function isTaskBodyChar(ch: string): boolean {
  return isValidTaskChar(ch) || (ch >= "0" && ch <= "9") || ch === "-" || ch === ":";
}

function flushPreviousTask(tasks: TaskfileTask[], taskName: string | undefined): void {
  if (taskName === undefined) {
    return;
  }
  const alreadyExists = tasks.some((t) => t.name === taskName);
  if (!alreadyExists) {
    tasks.push({ name: taskName });
  }
}

function extractDescription(trimmed: string): string | undefined {
  const prefixes = ["desc:", "description:"];
  const matched = prefixes.find((p) => trimmed.startsWith(p));
  if (matched === undefined) {
    return undefined;
  }
  const raw = trimmed.substring(matched.length).trim();
  if (raw === "") {
    return undefined;
  }
  return stripQuotes(raw);
}

function stripQuotes(value: string): string {
  if (value.length < 2) {
    return value;
  }
  const first = value[0];
  const last = value[value.length - 1];
  const isQuoted = (first === "'" || first === '"') && first === last;
  return isQuoted ? value.substring(1, value.length - 1) : value;
}

function applyDescription(tasks: TaskfileTask[], currentTask: string, description: string): string | undefined {
  const existing = tasks.find((t) => t.name === currentTask);
  if (existing !== undefined) {
    existing.description = description;
    return currentTask;
  }
  tasks.push({ name: currentTask, description });
  return undefined;
}

/**
 * Parses Taskfile.yml to extract task names and descriptions.
 * Uses simple YAML parsing without a full parser.
 */
function parseTaskfileTasks(content: string): TaskfileTask[] {
  const tasks: TaskfileTask[] = [];
  const lines = content.split("\n");
  const state: ParseState = { inTasks: false, sectionIndent: 0, currentTask: undefined, taskIndent: 0 };

  for (const line of lines) {
    const trimmed = line.trim();
    if (isSkippableLine(trimmed)) {
      continue;
    }
    const indent = leadingSpaces(line);
    processLine({ tasks, state, indent, trimmed });
  }

  flushPreviousTask(tasks, state.currentTask);
  return tasks;
}

interface LineContext {
  tasks: TaskfileTask[];
  state: ParseState;
  indent: number;
  trimmed: string;
}

function processLine({ tasks, state, indent, trimmed }: LineContext): void {
  if (trimmed === "tasks:") {
    state.inTasks = true;
    state.sectionIndent = indent;
    return;
  }
  if (isLeavingTasksSection(state, indent, trimmed)) {
    state.inTasks = false;
    return;
  }
  if (!state.inTasks) {
    return;
  }
  processTaskSectionLine({ tasks, state, indent, trimmed });
}

function processTaskSectionLine({ tasks, state, indent, trimmed }: LineContext): void {
  if (indent > state.sectionIndent) {
    const taskName = extractTaskName(trimmed);
    if (taskName !== undefined) {
      flushPreviousTask(tasks, state.currentTask);
      state.currentTask = taskName;
      state.taskIndent = indent;
      return;
    }
  }
  if (state.currentTask === undefined || indent <= state.taskIndent) {
    return;
  }
  const description = extractDescription(trimmed);
  if (description === undefined) {
    return;
  }
  state.currentTask = applyDescription(tasks, state.currentTask, description);
}
