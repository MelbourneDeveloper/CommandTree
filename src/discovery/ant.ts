import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId, simplifyPath } from "../models/TaskItem";
import { readFileContent } from "../utils/fileUtils";

export const ICON_DEF: IconDef = {
  icon: "symbol-constructor",
  color: "terminal.ansiYellow",
};
export const CATEGORY_DEF: CategoryDef = { type: "ant", label: "Ant Targets" };

/**
 * Discovers Ant targets from build.xml files.
 * Only returns tasks if Java source files (.java) exist in the workspace.
 */
export async function discoverAntTargets(workspaceRoot: string, excludePatterns: string[]): Promise<CommandItem[]> {
  const exclude = `{${excludePatterns.join(",")}}`;

  // Check if any Java source files exist before processing
  const javaFiles = await vscode.workspace.findFiles("**/*.java", exclude);
  if (javaFiles.length === 0) {
    return []; // No Java source code, skip Ant targets
  }

  const files = await vscode.workspace.findFiles("**/build.xml", exclude);
  const commands: CommandItem[] = [];

  for (const file of files) {
    const content = await readFileContent(file);
    const antDir = path.dirname(file.fsPath);
    const category = simplifyPath(file.fsPath, workspaceRoot);
    const targets = parseAntTargets(content);

    for (const target of targets) {
      commands.push({
        id: generateCommandId("ant", file.fsPath, target.name),
        label: target.name,
        type: "ant",
        category,
        command: `ant ${target.name}`,
        cwd: antDir,
        filePath: file.fsPath,
        tags: [],
        ...(target.description !== undefined ? { description: target.description } : {}),
      });
    }
  }

  return commands;
}

interface AntTarget {
  name: string;
  description?: string;
}

const TARGET_TAG_OPEN = "<target";
const ATTR_NAME = "name";
const ATTR_DESCRIPTION = "description";

/** Extracts the value of an attribute from an XML tag string, or undefined if absent. */
function extractAttribute(tag: string, attr: string): string | undefined {
  const prefix = `${attr}=`;
  const attrStart = tag.indexOf(prefix);
  if (attrStart === -1) {
    return undefined;
  }
  const quoteChar = tag.charAt(attrStart + prefix.length);
  if (quoteChar !== '"' && quoteChar !== "'") {
    return undefined;
  }
  const valueStart = attrStart + prefix.length + 1;
  const valueEnd = tag.indexOf(quoteChar, valueStart);
  if (valueEnd === -1) {
    return undefined;
  }
  return tag.substring(valueStart, valueEnd);
}

/** Finds all <target ...> tag strings in the content. */
function findTargetTags(content: string): string[] {
  const tags: string[] = [];
  let searchFrom = 0;
  for (;;) {
    const openIdx = content.indexOf(TARGET_TAG_OPEN, searchFrom);
    if (openIdx === -1) {
      break;
    }
    const closeIdx = content.indexOf(">", openIdx);
    if (closeIdx === -1) {
      break;
    }
    tags.push(content.substring(openIdx, closeIdx + 1));
    searchFrom = closeIdx + 1;
  }
  return tags;
}

/** Builds an AntTarget from a tag string if it has a valid name. */
function tagToTarget(tag: string): AntTarget | undefined {
  const name = extractAttribute(tag, ATTR_NAME);
  if (name === undefined || name === "") {
    return undefined;
  }
  const description = extractAttribute(tag, ATTR_DESCRIPTION);
  return {
    name,
    ...(description !== undefined && description !== "" ? { description } : {}),
  };
}

/** Parses build.xml to extract target names and descriptions. */
function parseAntTargets(content: string): AntTarget[] {
  const seen = new Set<string>();
  const targets: AntTarget[] = [];
  for (const tag of findTargetTags(content)) {
    const target = tagToTarget(tag);
    if (target !== undefined && !seen.has(target.name)) {
      seen.add(target.name);
      targets.push(target);
    }
  }
  return targets;
}
