import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, MutableCommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId, simplifyPath } from "../models/TaskItem";
import { readFileContent, parseFirstLineComment } from "../utils/fileUtils";

export const ICON_DEF: IconDef = {
  icon: "file-code",
  color: "terminal.ansiBlue",
};
export const CATEGORY_DEF: CategoryDef = {
  type: "fsharp-script",
  label: "F# Scripts",
};

const COMMENT_PREFIX = "//";
const COMMAND_PREFIX = "dotnet fsi";

/**
 * SPEC: command-discovery/fsharp-scripts
 *
 * Discovers F# script files (.fsx) in the workspace.
 * Runs via `dotnet fsi`.
 */
export async function discoverFsharpScripts(workspaceRoot: string, excludePatterns: string[]): Promise<CommandItem[]> {
  const exclude = `{${excludePatterns.join(",")}}`;
  const files = await vscode.workspace.findFiles("**/*.fsx", exclude);
  const commands: CommandItem[] = [];

  for (const file of files) {
    const content = await readFileContent(file);
    const name = path.basename(file.fsPath);
    const description = parseFirstLineComment(content, COMMENT_PREFIX);

    const task: MutableCommandItem = {
      id: generateCommandId("fsharp-script", file.fsPath, name),
      label: name,
      type: "fsharp-script",
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
