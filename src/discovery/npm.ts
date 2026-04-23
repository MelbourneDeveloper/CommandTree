import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId, simplifyPath } from "../models/TaskItem";
import { readFileContent } from "../utils/fileUtils";

export const ICON_DEF: IconDef = {
  icon: "package",
  color: "terminal.ansiMagenta",
};
export const CATEGORY_DEF: CategoryDef = { type: "npm", label: "NPM Scripts" };

interface PackageJson {
  scripts?: Record<string, string>;
}

/**
 * SPEC: command-discovery/npm-scripts
 *
 * Discovers npm scripts from package.json files.
 */
export async function discoverNpmScripts(workspaceRoot: string, excludePatterns: string[]): Promise<CommandItem[]> {
  const exclude = `{${excludePatterns.join(",")}}`;
  const files = await vscode.workspace.findFiles("**/package.json", exclude);
  const commands: CommandItem[] = [];

  for (const file of files) {
    const content = await readFileContent(file);
    const pkg = JSON.parse(content) as PackageJson;
    if (pkg.scripts === undefined) {
      continue;
    }

    const pkgDir = path.dirname(file.fsPath);
    const category = simplifyPath(file.fsPath, workspaceRoot);

    for (const [name, command] of Object.entries(pkg.scripts)) {
      commands.push({
        id: generateCommandId("npm", file.fsPath, name),
        label: name,
        type: "npm",
        category,
        command: `npm run ${name}`,
        cwd: pkgDir,
        filePath: file.fsPath,
        tags: [],
        description: truncate(command, 60),
      });
    }
  }

  return commands;
}

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max - 3)}...` : str;
}
