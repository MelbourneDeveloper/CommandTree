import * as fs from "fs";
import * as path from "path";
import type { CommandItem } from "../models/TaskItem";
import type { DbHandle } from "../db/db";
import { addTagToCommand, removeTagFromCommand, getCommandIdsByTag } from "../db/db";
import { getDbOrThrow } from "../db/lifecycle";
import { logger } from "../utils/logger";

interface TagPattern {
  readonly id?: string;
  readonly type?: string;
  readonly label?: string;
}

interface TagConfig {
  readonly tags?: Record<string, Array<string | TagPattern>>;
}

function matchesPattern(task: CommandItem, pattern: string | TagPattern): boolean {
  if (typeof pattern === "string") {
    return task.id === pattern;
  }
  if (pattern.type !== undefined && task.type !== pattern.type) {
    return false;
  }
  if (pattern.label !== undefined && task.label !== pattern.label) {
    return false;
  }
  if (pattern.id !== undefined && task.id !== pattern.id) {
    return false;
  }
  return true;
}

function collectMatchedIds(
  patterns: ReadonlyArray<string | TagPattern>,
  allTasks: readonly CommandItem[]
): Set<string> {
  const matched = new Set<string>();
  for (const pattern of patterns) {
    for (const task of allTasks) {
      if (matchesPattern(task, pattern)) {
        matched.add(task.id);
      }
    }
  }
  return matched;
}

function syncTagDiff({
  handle,
  tagName,
  currentIds,
  matchedIds,
}: {
  readonly handle: DbHandle;
  readonly tagName: string;
  readonly currentIds: ReadonlySet<string>;
  readonly matchedIds: ReadonlySet<string>;
}): void {
  for (const id of currentIds) {
    if (!matchedIds.has(id)) {
      removeTagFromCommand({ handle, commandId: id, tagName });
    }
  }
  for (const id of matchedIds) {
    if (!currentIds.has(id)) {
      addTagToCommand({ handle, commandId: id, tagName });
    }
  }
}

function readTagConfig(configPath: string): TagConfig | undefined {
  if (!fs.existsSync(configPath)) {
    return undefined;
  }
  const content = fs.readFileSync(configPath, "utf8");
  return JSON.parse(content) as TagConfig;
}

export function syncTagsFromConfig({
  allTasks,
  workspaceRoot,
}: {
  readonly allTasks: readonly CommandItem[];
  readonly workspaceRoot: string;
}): boolean {
  const configPath = path.join(workspaceRoot, ".vscode", "commandtree.json");
  const config = readTagConfig(configPath);
  if (config?.tags === undefined) {
    return false;
  }
  const handle = getDbOrThrow();
  for (const [tagName, patterns] of Object.entries(config.tags)) {
    const existingIds = getCommandIdsByTag({ handle, tagName });
    const currentIds = new Set(existingIds);
    const matchedIds = collectMatchedIds(patterns, allTasks);
    syncTagDiff({ handle, tagName, currentIds, matchedIds });
  }
  logger.info("Tag sync complete");
  return true;
}
