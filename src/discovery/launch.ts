import * as vscode from "vscode";
import type {
  CommandItem,
  MutableCommandItem,
  IconDef,
  CategoryDef,
} from "../models/TaskItem";
import { generateCommandId } from "../models/TaskItem";
import { readJsonFile } from "../utils/fileUtils";

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
  name?: string;
  type?: string;
}

interface LaunchJson {
  configurations?: LaunchConfig[];
}

/**
 * SPEC: command-discovery/launch-configurations
 *
 * Discovers VS Code launch configurations.
 */
export async function discoverLaunchConfigs(
  workspaceRoot: string,
  excludePatterns: string[],
): Promise<CommandItem[]> {
  const exclude = `{${excludePatterns.join(",")}}`;
  const files = await vscode.workspace.findFiles(
    "**/.vscode/launch.json",
    exclude,
  );
  const commands: CommandItem[] = [];

  for (const file of files) {
    const result = await readJsonFile<LaunchJson>(file);
    if (!result.ok) {
      continue; // Skip malformed launch.json
    }

    const launch = result.value;
    if (
      launch.configurations === undefined ||
      !Array.isArray(launch.configurations)
    ) {
      continue;
    }

    for (const config of launch.configurations) {
      if (config.name === undefined) {
        continue;
      }

      const task: MutableCommandItem = {
        id: generateCommandId("launch", file.fsPath, config.name),
        label: config.name,
        type: "launch",
        category: "VS Code Launch",
        command: config.name, // Used to identify the config
        cwd: workspaceRoot,
        filePath: file.fsPath,
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
