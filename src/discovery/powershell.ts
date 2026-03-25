import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, MutableCommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId, simplifyPath } from "../models/TaskItem";
import { readFile } from "../utils/fileUtils";
import {
  parsePowerShellParams as parseParams,
  parsePowerShellDescription as parsePsDescription,
  parseBatchDescription as parseBatDescription,
} from "./parsers/powershellParser";

export const ICON_DEF: IconDef = {
  icon: "terminal-powershell",
  color: "terminal.ansiBlue",
};
export const CATEGORY_DEF: CategoryDef = {
  type: "powershell",
  label: "PowerShell/Batch",
};

/**
 * Discovers PowerShell and Batch scripts (.ps1, .bat, .cmd files) in the workspace.
 */
export async function discoverPowerShellScripts(
  workspaceRoot: string,
  excludePatterns: string[]
): Promise<CommandItem[]> {
  const exclude = `{${excludePatterns.join(",")}}`;
  const [ps1Files, batFiles, cmdFiles] = await Promise.all([
    vscode.workspace.findFiles("**/*.ps1", exclude),
    vscode.workspace.findFiles("**/*.bat", exclude),
    vscode.workspace.findFiles("**/*.cmd", exclude),
  ]);
  const allFiles = [...ps1Files, ...batFiles, ...cmdFiles];
  const commands: CommandItem[] = [];

  for (const file of allFiles) {
    const result = await readFile(file);
    if (!result.ok) {
      continue; // Skip files we can't read
    }

    const content = result.value;
    const name = path.basename(file.fsPath);
    const ext = path.extname(file.fsPath).toLowerCase();
    const isPowerShell = ext === ".ps1";

    const params = isPowerShell ? parseParams(content) : [];
    const description = isPowerShell ? parsePsDescription(content) : parseBatDescription(content);

    const task: MutableCommandItem = {
      id: generateCommandId("powershell", file.fsPath, name),
      label: name,
      type: "powershell",
      category: simplifyPath(file.fsPath, workspaceRoot),
      command: isPowerShell ? `powershell -File "${file.fsPath}"` : `"${file.fsPath}"`,
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
