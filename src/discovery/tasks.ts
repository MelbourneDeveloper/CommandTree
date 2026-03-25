import * as vscode from "vscode";
import type { CommandItem, ParamDef, MutableCommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId } from "../models/TaskItem";
import { readJsonFile } from "../utils/fileUtils";

export const ICON_DEF: IconDef = { icon: "gear", color: "terminal.ansiBlue" };
export const CATEGORY_DEF: CategoryDef = {
  type: "vscode",
  label: "VS Code Tasks",
  flat: true,
};

interface TaskInput {
  id: string;
  description?: string;
  default?: string;
  options?: string[];
}

interface VscodeTaskDef {
  label?: string;
  type?: string;
  script?: string;
  detail?: string;
}

interface TasksJsonConfig {
  tasks?: VscodeTaskDef[];
  inputs?: TaskInput[];
}

/**
 * SPEC: command-discovery/vscode-tasks
 *
 * Discovers VS Code tasks from tasks.json.
 */
export async function discoverVsCodeTasks(workspaceRoot: string, excludePatterns: string[]): Promise<CommandItem[]> {
  const exclude = `{${excludePatterns.join(",")}}`;
  const files = await vscode.workspace.findFiles("**/.vscode/tasks.json", exclude);
  const commands: CommandItem[] = [];

  for (const file of files) {
    const result = await readJsonFile<TasksJsonConfig>(file);
    if (!result.ok) {
      continue; // Skip malformed tasks.json
    }

    const tasksConfig = result.value;
    if (tasksConfig.tasks === undefined || !Array.isArray(tasksConfig.tasks)) {
      continue;
    }

    const inputs = parseInputs(tasksConfig.inputs);
    const fileCommands = tasksConfig.tasks.flatMap((task) => buildTaskCommand({ task, inputs, file, workspaceRoot }));
    commands.push(...fileCommands);
  }

  return commands;
}

function buildTaskCommand({
  task,
  inputs,
  file,
  workspaceRoot,
}: {
  task: VscodeTaskDef;
  inputs: Map<string, ParamDef>;
  file: vscode.Uri;
  workspaceRoot: string;
}): CommandItem[] {
  const label = resolveTaskLabel(task);
  if (label === undefined) {
    return [];
  }

  const taskParams = findTaskInputs(task, inputs);
  const taskItem: MutableCommandItem = {
    id: generateCommandId("vscode", file.fsPath, label),
    label,
    type: "vscode",
    category: "VS Code Tasks",
    command: label,
    cwd: workspaceRoot,
    filePath: file.fsPath,
    tags: [],
  };
  if (taskParams.length > 0) {
    taskItem.params = taskParams;
  }
  if (task.detail !== undefined && typeof task.detail === "string" && task.detail !== "") {
    taskItem.description = task.detail;
  }
  return [taskItem];
}

function resolveTaskLabel(task: VscodeTaskDef): string | undefined {
  if (task.label !== undefined) {
    return task.label;
  }
  if (task.type === "npm" && task.script !== undefined) {
    return `npm: ${task.script}`;
  }
  return undefined;
}

/**
 * Parses input definitions from tasks.json.
 */
function parseInputs(inputs: TaskInput[] | undefined): Map<string, ParamDef> {
  const map = new Map<string, ParamDef>();
  if (!Array.isArray(inputs)) {
    return map;
  }

  for (const input of inputs) {
    const param: ParamDef = {
      name: input.id,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.default !== undefined ? { default: input.default } : {}),
      ...(input.options !== undefined ? { options: input.options } : {}),
    };
    map.set(input.id, param);
  }

  return map;
}

/**
 * Finds input references in a task definition.
 */
const INPUT_PREFIX = "${input:";
const INPUT_SUFFIX = "}";

function findTaskInputs(task: VscodeTaskDef, inputs: Map<string, ParamDef>): ParamDef[] {
  const params: ParamDef[] = [];
  const taskStr = JSON.stringify(task);

  for (const inputId of extractInputIds(taskStr)) {
    const param = inputs.get(inputId);
    if (param !== undefined && !params.some((p) => p.name === param.name)) {
      params.push(param);
    }
  }

  return params;
}

function extractInputIds(text: string): string[] {
  const ids: string[] = [];
  let searchFrom = 0;

  for (;;) {
    const start = text.indexOf(INPUT_PREFIX, searchFrom);
    if (start === -1) {
      break;
    }
    const idStart = start + INPUT_PREFIX.length;
    const end = text.indexOf(INPUT_SUFFIX, idStart);
    if (end === -1) {
      break;
    }
    ids.push(text.slice(idStart, end));
    searchFrom = end + INPUT_SUFFIX.length;
  }

  return ids;
}
