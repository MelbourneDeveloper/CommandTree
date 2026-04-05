import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, MutableCommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId, simplifyPath } from "../models/TaskItem";
import { readFile } from "../utils/fileUtils";
import { parseMiseToml, parseMiseYaml } from "./parsers/miseParser";

export { parseMiseToml, parseMiseYaml } from "./parsers/miseParser";
export type { MiseTask } from "./parsers/miseParser";

export const ICON_DEF: IconDef = {
  icon: "package",
  color: "terminal.ansiCyan",
};

export const CATEGORY_DEF: CategoryDef = {
  type: "mise",
  label: "Mise Tasks",
};

/**
 * Discovers Mise tasks from mise configuration files.
 */
export async function discoverMiseTasks(workspaceRoot: string, excludePatterns: string[]): Promise<CommandItem[]> {
  const exclude = `{${excludePatterns.join(",")}}`;

  // Mise supports: mise.toml, .mise.toml, mise.yaml, .mise.yaml
  const [miseToml, dotMiseToml, miseYaml, dotMiseYaml] = await Promise.all([
    vscode.workspace.findFiles("**/mise.toml", exclude),
    vscode.workspace.findFiles("**/.mise.toml", exclude),
    vscode.workspace.findFiles("**/mise.yaml", exclude),
    vscode.workspace.findFiles("**/.mise.yaml", exclude),
  ]);

  const allFiles = [...miseToml, ...dotMiseToml, ...miseYaml, ...dotMiseYaml];
  const commands: CommandItem[] = [];

  for (const file of allFiles) {
    const result = await readFile(file);
    if (!result.ok) {
      continue;
    }

    const content = result.value;
    const miseDir = path.dirname(file.fsPath);
    const category = simplifyPath(file.fsPath, workspaceRoot);

    const tasks =
      file.fsPath.endsWith(".yaml") || file.fsPath.endsWith(".yml") ? parseMiseYaml(content) : parseMiseToml(content);

    for (const task of tasks) {
      const taskCommand: MutableCommandItem = {
        id: generateCommandId("mise", file.fsPath, task.name),
        label: task.name,
        type: "mise",
        category,
        command: `mise run ${task.name}`,
        cwd: miseDir,
        filePath: file.fsPath,
        tags: [],
      };

      if (task.params.length > 0) {
        taskCommand.params = task.params;
      }

      if (task.description !== undefined) {
        taskCommand.description = task.description;
      }

      commands.push(taskCommand);
    }
  }

  return commands;
}
