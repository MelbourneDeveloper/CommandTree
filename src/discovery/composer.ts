import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, MutableCommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId, simplifyPath } from "../models/TaskItem";
import { readFile, parseJson } from "../utils/fileUtils";

export const ICON_DEF: IconDef = {
  icon: "symbol-interface",
  color: "terminal.ansiYellow",
};
export const CATEGORY_DEF: CategoryDef = {
  type: "composer",
  label: "Composer Scripts",
};

interface ComposerJson {
  scripts?: Record<string, string | string[]>;
  "scripts-descriptions"?: Record<string, string>;
}

/**
 * Discovers Composer scripts from composer.json files.
 * Only returns tasks if PHP source files (.php) exist in the workspace.
 */
export async function discoverComposerScripts(
  workspaceRoot: string,
  excludePatterns: string[]
): Promise<CommandItem[]> {
  const exclude = `{${excludePatterns.join(",")}}`;

  const phpFiles = await vscode.workspace.findFiles("**/*.php", exclude);
  if (phpFiles.length === 0) {
    return [];
  }

  const files = await vscode.workspace.findFiles("**/composer.json", exclude);
  const nested = await Promise.all(files.map(async (file) => await extractScriptsFromFile(file, workspaceRoot)));
  return nested.flat();
}

function isLifecycleHook(name: string): boolean {
  return name.startsWith("pre-") || name.startsWith("post-");
}

interface BuildCommandItemParams {
  name: string;
  command: string | string[];
  descriptions: Record<string, string>;
  filePath: string;
  composerDir: string;
  category: string;
}

function buildCommandItem(params: BuildCommandItemParams): CommandItem {
  const description = params.descriptions[params.name] ?? getCommandPreview(params.command);
  const task: MutableCommandItem = {
    id: generateCommandId("composer", params.filePath, params.name),
    label: params.name,
    type: "composer",
    category: params.category,
    command: `composer run-script ${params.name}`,
    cwd: params.composerDir,
    filePath: params.filePath,
    tags: [],
  };
  if (description !== "") {
    task.description = description;
  }
  return task;
}

async function extractScriptsFromFile(file: vscode.Uri, workspaceRoot: string): Promise<CommandItem[]> {
  const contentResult = await readFile(file);
  if (!contentResult.ok) {
    return [];
  }

  const composerResult = parseJson<ComposerJson>(contentResult.value);
  if (!composerResult.ok) {
    return [];
  }

  const composer = composerResult.value;
  if (composer.scripts === undefined || typeof composer.scripts !== "object") {
    return [];
  }

  const composerDir = path.dirname(file.fsPath);
  const category = simplifyPath(file.fsPath, workspaceRoot);
  const descriptions = composer["scripts-descriptions"] ?? {};

  return Object.entries(composer.scripts)
    .filter(([name]) => !isLifecycleHook(name))
    .map(([name, command]) =>
      buildCommandItem({ name, command, descriptions, filePath: file.fsPath, composerDir, category })
    );
}

/**
 * Gets a preview of the command for description.
 */
function getCommandPreview(command: string | string[]): string {
  if (Array.isArray(command)) {
    const preview = command.join(" && ");
    return truncate(preview, 60);
  }
  return truncate(command, 60);
}

/**
 * Truncates a string to a maximum length.
 */
function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max - 3)}...` : str;
}
