import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, MutableCommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId, simplifyPath } from "../models/TaskItem";
import { readFileContent } from "../utils/fileUtils";

export const ICON_DEF: IconDef = {
  icon: "markdown",
  color: "terminal.ansiCyan",
};
export const CATEGORY_DEF: CategoryDef = {
  type: "markdown",
  label: "Markdown Files",
};

const MAX_DESCRIPTION_LENGTH = 150;

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

/**
 * Extracts a description from the markdown content.
 * Uses the first heading or first paragraph.
 */
function extractDescription(content: string): string | undefined {
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "") {
      continue;
    }

    if (trimmed.startsWith("#")) {
      const heading = trimmed.replace(/^#+\s*/, "").trim();
      if (heading !== "") {
        return truncate(heading);
      }
      continue;
    }

    if (!trimmed.startsWith("```") && !trimmed.startsWith("---")) {
      return truncate(trimmed);
    }
  }

  return undefined;
}

function truncate(text: string): string {
  if (text.length <= MAX_DESCRIPTION_LENGTH) {
    return text;
  }
  return `${text.substring(0, MAX_DESCRIPTION_LENGTH)}...`;
}
