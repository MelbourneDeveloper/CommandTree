import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, ParamDef, MutableCommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId, simplifyPath } from "../models/TaskItem";
import { readFileContent } from "../utils/fileUtils";

export const ICON_DEF: IconDef = {
  icon: "terminal",
  color: "terminal.ansiGreen",
};
export const CATEGORY_DEF: CategoryDef = {
  type: "shell",
  label: "Shell Scripts",
};

/**
 * SPEC: command-discovery/shell-scripts
 *
 * Discovers shell scripts (.sh files) in the workspace.
 */
export async function discoverShellScripts(workspaceRoot: string, excludePatterns: string[]): Promise<CommandItem[]> {
  const exclude = `{${excludePatterns.join(",")}}`;
  const files = await vscode.workspace.findFiles("**/*.sh", exclude);
  const commands: CommandItem[] = [];

  for (const file of files) {
    const content = await readFileContent(file);
    const name = path.basename(file.fsPath);
    const params = parseShellParams(content);
    const description = parseShellDescription(content);

    const task: MutableCommandItem = {
      id: generateCommandId("shell", file.fsPath, name),
      label: name,
      type: "shell",
      category: simplifyPath(file.fsPath, workspaceRoot),
      command: file.fsPath,
      cwd: path.dirname(file.fsPath),
      filePath: file.fsPath,
      tags: [],
    };
    if (params.length > 0) {
      task.params = params;
    }
    if (description !== undefined && description !== "") {
      task.description = description;
    }
    commands.push(task);
  }

  return commands;
}

/**
 * Parses shell script comments for parameter hints.
 * Supports: # @param name Description
 */
function parseShellParams(content: string): ParamDef[] {
  const params: ParamDef[] = [];
  const paramRegex = /^#\s*@param\s+(\w+)\s+(.*)$/gm;

  let match;
  while ((match = paramRegex.exec(content)) !== null) {
    const paramName = match[1];
    const descText = match[2];
    if (paramName === undefined || descText === undefined) {
      continue;
    }

    const defaultRegex = /\(default:\s*([^)]+)\)/i;
    const defaultMatch = defaultRegex.exec(descText);
    const defaultVal = defaultMatch?.[1]?.trim();
    const param: ParamDef = {
      name: paramName,
      description: descText.replace(/\(default:[^)]+\)/i, "").trim(),
      ...(defaultVal !== undefined && defaultVal !== "" ? { default: defaultVal } : {}),
    };
    params.push(param);
  }

  return params;
}

/**
 * Parses the first comment line as description.
 */
function parseShellDescription(content: string): string | undefined {
  const lines = content.split("\n");
  for (const line of lines) {
    if (line.startsWith("#!")) {
      continue;
    }
    if (line.trim() === "") {
      continue;
    }
    if (line.startsWith("#")) {
      const desc = line.replace(/^#\s*/, "").trim();
      if (!desc.startsWith("@")) {
        return desc === "" ? undefined : desc;
      }
    }
    break;
  }
  return undefined;
}
