import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, MutableCommandItem, IconDef, CategoryDef } from "../models/TaskItem";
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
    const phonyTargets = parsePhonyTargets(content);
    const targets = parseMakeTargets(content);
    const makeDir = path.dirname(file.fsPath);
    const category = simplifyPath(file.fsPath, workspaceRoot);

    for (const { name, line } of targets) {
      // Skip internal targets (start with .)
      if (name.startsWith(".")) {
        continue;
      }

      const command: MutableCommandItem = {
        id: generateCommandId("make", file.fsPath, name),
        label: name,
        type: "make",
        category,
        command: `make ${name}`,
        cwd: makeDir,
        filePath: file.fsPath,
        tags: [],
        line,
      };

      if (phonyTargets.has(name)) {
        command.isPhony = true;
      }

      commands.push(command);
    }
  }

  return commands;
}

interface MakeTarget {
  readonly name: string;
  readonly line: number;
}

function addPhonyTargets(line: string, phonyTargets: Set<string>): void {
  for (const name of line.split(/\s+/)) {
    if (name !== "") {
      phonyTargets.add(name);
    }
  }
}

function trimContinuation(line: string): string {
  return line.endsWith("\\") ? line.slice(0, -1).trim() : line;
}

function isContinuationLine(line: string): boolean {
  return line.endsWith("\\");
}

function readPhonyLine(line: string): string | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith(".PHONY:")) {
    return undefined;
  }
  return trimmed.slice(".PHONY:".length).trim();
}

function parsePhonyTargets(content: string): ReadonlySet<string> {
  const phonyTargets = new Set<string>();
  let collecting = false;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (collecting) {
      addPhonyTargets(trimContinuation(trimmed), phonyTargets);
      collecting = isContinuationLine(trimmed);
      continue;
    }

    const phonyLine = readPhonyLine(line);
    if (phonyLine === undefined) {
      continue;
    }

    addPhonyTargets(trimContinuation(phonyLine), phonyTargets);
    collecting = isContinuationLine(phonyLine);
  }

  return phonyTargets;
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
