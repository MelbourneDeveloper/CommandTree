import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, MutableCommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId, simplifyPath } from "../models/TaskItem";
import { readFileContent, removeJsonComments } from "../utils/fileUtils";

export const ICON_DEF: IconDef = {
  icon: "symbol-namespace",
  color: "terminal.ansiWhite",
};
export const CATEGORY_DEF: CategoryDef = { type: "deno", label: "Deno Tasks" };

interface DenoJson {
  tasks?: Record<string, string>;
}

/**
 * Discovers Deno tasks from deno.json and deno.jsonc files.
 * Only returns tasks if TypeScript/JavaScript source files exist (excluding node_modules).
 */
export async function discoverDenoTasks(workspaceRoot: string, excludePatterns: string[]): Promise<CommandItem[]> {
  const exclude = `{${excludePatterns.join(",")}}`;

  // Check if any TS/JS source files exist (outside node_modules)
  const excludeWithNodeModules = `{${[...excludePatterns, "**/node_modules/**"].join(",")}}`;
  const [tsFiles, jsFiles] = await Promise.all([
    vscode.workspace.findFiles("**/*.ts", excludeWithNodeModules),
    vscode.workspace.findFiles("**/*.js", excludeWithNodeModules),
  ]);
  if (tsFiles.length === 0 && jsFiles.length === 0) {
    return []; // No source files outside node_modules, skip Deno tasks
  }

  const [jsonFiles, jsoncFiles] = await Promise.all([
    vscode.workspace.findFiles("**/deno.json", exclude),
    vscode.workspace.findFiles("**/deno.jsonc", exclude),
  ]);
  const allFiles = [...jsonFiles, ...jsoncFiles];
  const commands: CommandItem[] = [];

  for (const file of allFiles) {
    const content = await readFileContent(file);
    const cleanJson = removeJsonComments(content);
    const deno = JSON.parse(cleanJson) as DenoJson;
    if (deno.tasks === undefined || typeof deno.tasks !== "object") {
      continue;
    }

    const denoDir = path.dirname(file.fsPath);
    const category = simplifyPath(file.fsPath, workspaceRoot);

    for (const [name, command] of Object.entries(deno.tasks)) {
      if (typeof command !== "string") {
        continue;
      }

      const task: MutableCommandItem = {
        id: generateCommandId("deno", file.fsPath, name),
        label: name,
        type: "deno",
        category,
        command: `deno task ${name}`,
        cwd: denoDir,
        filePath: file.fsPath,
        tags: [],
        description: truncate(command, 60),
      };
      commands.push(task);
    }
  }

  return commands;
}

/**
 * Truncates a string to a maximum length.
 */
function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max - 3)}...` : str;
}
