import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, MutableCommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId, simplifyPath } from "../models/TaskItem";
import { readFileContent } from "../utils/fileUtils";
import { extractDescription } from "./parsers/markdownParser";

export const ICON_DEF: IconDef = {
  icon: "markdown",
  color: "terminal.ansiCyan",
};
export const CATEGORY_DEF: CategoryDef = {
  type: "markdown",
  label: "Markdown Files",
};

/**
 * Discovers Markdown files (.md) in the workspace.
 */
export async function discoverMarkdownFiles(workspaceRoot: string, excludePatterns: string[]): Promise<CommandItem[]> {
  const exclude = `{${excludePatterns.join(",")}}`;
  const files = await vscode.workspace.findFiles("**/*.md", exclude);
  const commands: CommandItem[] = [];

  for (const file of files) {
    const content = await readFileContent(file);
    const name = path.basename(file.fsPath);
    const description = extractDescription(content);

    const task: MutableCommandItem = {
      id: generateCommandId("markdown", file.fsPath, name),
      label: name,
      type: "markdown",
      category: simplifyPath(file.fsPath, workspaceRoot),
      command: file.fsPath,
      cwd: path.dirname(file.fsPath),
      filePath: file.fsPath,
      tags: [],
    };

    if (description !== undefined && description !== "") {
      task.description = description;
    }

    commands.push(task);
  }

  return commands;
}
