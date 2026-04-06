import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, MutableCommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId, simplifyPath } from "../models/TaskItem";
import { readFileContent, parseFirstLineComment } from "../utils/fileUtils";

export const ICON_DEF: IconDef = {
  icon: "file-code",
  color: "terminal.ansiMagenta",
};
export const CATEGORY_DEF: CategoryDef = {
  type: "csharp-script",
  label: "C# Scripts",
};

const COMMENT_PREFIX = "//";
const COMMAND_PREFIX = "dotnet script";

/**
 * SPEC: command-discovery/csharp-scripts
 *
 * Discovers C# script files (.csx) in the workspace.
 * Runs via `dotnet script`.
 */
export async function discoverCsharpScripts(workspaceRoot: string, excludePatterns: string[]): Promise<CommandItem[]> {
  const exclude = `{${excludePatterns.join(",")}}`;
  const files = await vscode.workspace.findFiles("**/*.csx", exclude);
  const commands: CommandItem[] = [];

  for (const file of files) {
    const content = await readFileContent(file);
    const name = path.basename(file.fsPath);
    const description = parseFirstLineComment(content, COMMENT_PREFIX);

    const task: MutableCommandItem = {
      id: generateCommandId("csharp-script", file.fsPath, name),
      label: name,
      type: "csharp-script",
      category: simplifyPath(file.fsPath, workspaceRoot),
      command: `${COMMAND_PREFIX} "${file.fsPath}"`,
      cwd: path.dirname(file.fsPath),
      filePath: file.fsPath,
      tags: [],
    };
    if (description !== undefined) {
      task.description = description;
    }
    commands.push(task);
  }

  return commands;
}
