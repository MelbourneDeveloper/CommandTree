import * as vscode from "vscode";
import type { CommandItem, MutableCommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId } from "../models/TaskItem";

export const ICON_DEF: IconDef = {
  icon: "debug-alt",
  color: "debugIcon.startForeground",
};
export const CATEGORY_DEF: CategoryDef = {
  type: "launch",
  label: "VS Code Launch",
  flat: true,
};

interface LaunchConfig {
  readonly name?: string;
  readonly type?: string;
}

/**
 * SPEC: [DISC-LAUNCH], [DISC-PARSE-STRATEGY]
 *
 * Discovers VS Code launch configurations using the built-in configuration API.
 * VS Code handles JSONC parsing and variable substitution.
 */
export function discoverLaunchConfigs(workspaceRoot: string, _excludePatterns: string[]): CommandItem[] {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const commands: CommandItem[] = [];

  for (const folder of folders) {
    const launchConfig = vscode.workspace.getConfiguration("launch", folder.uri);
    const configurations = launchConfig.get<LaunchConfig[]>("configurations") ?? [];
    const filePath = vscode.Uri.joinPath(folder.uri, ".vscode", "launch.json").fsPath;

    for (const config of configurations) {
      if (config.name === undefined || config.name === "") {
        continue;
      }

      const task: MutableCommandItem = {
        id: generateCommandId("launch", filePath, config.name),
        label: config.name,
        type: "launch",
        category: "VS Code Launch",
        command: config.name,
        cwd: workspaceRoot,
        filePath,
        tags: [],
      };
      if (config.type !== undefined) {
        task.description = config.type;
      }
      commands.push(task);
    }
  }

  return commands;
}
