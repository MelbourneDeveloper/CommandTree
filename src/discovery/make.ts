import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId, simplifyPath } from "../models/TaskItem";
import { readFileContent } from "../utils/fileUtils";

export const ICON_DEF: IconDef = {
  icon: "tools",
  color: "terminal.ansiYellow",
};
export const CATEGORY_DEF: CategoryDef = {
  type: "make",
  label: "Make Targets",
};

/**
 * SPEC: command-discovery/makefile-targets
 *
 * Discovers make targets from Makefiles.
 */
export async function discoverMakeTargets(workspaceRoot: string, excludePatterns: string[]): Promise<CommandItem[]> {
  const exclude = `{${excludePatterns.join(",")}}`;
  // Look for Makefile, makefile, GNUmakefile
  const files = await vscode.workspace.findFiles("**/[Mm]akefile", exclude);
  const gnuFiles = await vscode.workspace.findFiles("**/GNUmakefile", exclude);
  const allFiles = [...files, ...gnuFiles];
  const commands: CommandItem[] = [];

  for (const file of allFiles) {
    const content = await readFileContent(file);
    const targets = parseMakeTargets(content);
    const makeDir = path.dirname(file.fsPath);
    const category = simplifyPath(file.fsPath, workspaceRoot);

    for (const { name, line } of targets) {
      // Skip internal targets (start with .)
      if (name.startsWith(".")) {
        continue;
      }

      commands.push({
        id: generateCommandId("make", file.fsPath, name),
        label: name,
        type: "make",
        category,
        command: `make ${name}`,
        cwd: makeDir,
        filePath: file.fsPath,
        tags: [],
        line,
      });
    }
  }

  return commands;
}

interface MakeTarget {
  readonly name: string;
  readonly line: number;
}

/**
 * Parses Makefile to extract target names and their line numbers.
 */
function parseMakeTargets(content: string): MakeTarget[] {
  const targets: MakeTarget[] = [];
  const seen = new Set<string>();
  // Match lines like "target:" or "target: dependencies"
  // But not variable assignments like "VAR = value" or "VAR := value"
  const targetRegex = /^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/gm;

  let match;
  while ((match = targetRegex.exec(content)) !== null) {
    const name = match[1];
    if (name === undefined || name === "" || seen.has(name)) {
      continue;
    }
    seen.add(name);
    const line = content.substring(0, match.index).split("\n").length;
    targets.push({ name, line });
  }

  return targets;
}
