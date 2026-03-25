import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, ParamDef, MutableCommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId, simplifyPath } from "../models/TaskItem";
import { readFile } from "../utils/fileUtils";

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

    const params = isPowerShell ? parsePowerShellParams(content) : [];
    const description = isPowerShell ? parsePowerShellDescription(content) : parseBatchDescription(content);

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

const PARAM_COMMENT_PREFIX = "# @param ";
const PARAM_BLOCK_KEYWORD = "param";
const DEFAULT_PREFIX = "(default:";
const DOLLAR_SIGN = "$";

/** Extracts the default value from a description like "(default: foo)" */
function extractDefault(desc: string): { cleanDesc: string; defaultVal: string | undefined } {
  const lower = desc.toLowerCase();
  const start = lower.indexOf(DEFAULT_PREFIX);
  if (start === -1) {
    return { cleanDesc: desc, defaultVal: undefined };
  }
  const end = desc.indexOf(")", start + DEFAULT_PREFIX.length);
  if (end === -1) {
    return { cleanDesc: desc, defaultVal: undefined };
  }
  const defaultVal = desc.slice(start + DEFAULT_PREFIX.length, end).trim();
  const cleanDesc = (desc.slice(0, start) + desc.slice(end + 1)).trim();
  return { cleanDesc, defaultVal: defaultVal === "" ? undefined : defaultVal };
}

/** Parses a single "# @param name description" comment line into a ParamDef. */
function parseParamComment(line: string): ParamDef | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith(PARAM_COMMENT_PREFIX)) {
    return undefined;
  }
  const rest = trimmed.slice(PARAM_COMMENT_PREFIX.length).trim();
  const spaceIdx = rest.indexOf(" ");
  const paramName = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx);
  const descText = spaceIdx === -1 ? "" : rest.slice(spaceIdx + 1);
  if (paramName === "") {
    return undefined;
  }
  const { cleanDesc, defaultVal } = extractDefault(descText);
  return {
    name: paramName,
    ...(cleanDesc !== "" ? { description: cleanDesc } : {}),
    ...(defaultVal !== undefined ? { default: defaultVal } : {}),
  };
}

/** Extracts the content inside the first param(...) block. */
function extractParamBlock(content: string): string | undefined {
  const lower = content.toLowerCase();
  const idx = lower.indexOf(PARAM_BLOCK_KEYWORD);
  if (idx === -1) {
    return undefined;
  }
  const afterKeyword = content.slice(idx + PARAM_BLOCK_KEYWORD.length).trimStart();
  if (!afterKeyword.startsWith("(")) {
    return undefined;
  }
  const closeIdx = afterKeyword.indexOf(")");
  if (closeIdx === -1) {
    return undefined;
  }
  return afterKeyword.slice(1, closeIdx);
}

/** Extracts $VarName identifiers from a param block string. */
function extractParamBlockVars(block: string, existing: ParamDef[]): ParamDef[] {
  const results: ParamDef[] = [];
  let remaining = block;
  while (remaining.includes(DOLLAR_SIGN)) {
    const dollarIdx = remaining.indexOf(DOLLAR_SIGN);
    const afterDollar = remaining.slice(dollarIdx + 1);
    const varName = takeWord(afterDollar);
    remaining = afterDollar.slice(varName.length);
    if (varName === "") {
      continue;
    }
    const alreadyExists = existing.some((p) => p.name.toLowerCase() === varName.toLowerCase());
    if (!alreadyExists) {
      results.push({ name: varName });
    }
  }
  return results;
}

/** Takes consecutive word characters (letters, digits, underscores) from the start of a string. */
function takeWord(s: string): string {
  let i = 0;
  while (i < s.length) {
    const c = s.charAt(i);
    if (!isWordChar(c)) {
      break;
    }
    i++;
  }
  return s.slice(0, i);
}

function isWordChar(c: string): boolean {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9") || c === "_";
}

/**
 * Parses PowerShell script comments for parameter hints.
 * Supports: # @param name Description
 * Also supports PowerShell param() blocks.
 */
function parsePowerShellParams(content: string): ParamDef[] {
  const lines = content.split("\n");
  const params: ParamDef[] = [];
  for (const line of lines) {
    const param = parseParamComment(line);
    if (param !== undefined) {
      params.push(param);
    }
  }
  const block = extractParamBlock(content);
  if (block !== undefined) {
    params.push(...extractParamBlockVars(block, params));
  }
  return params;
}

const BLOCK_COMMENT_START = "<#";
const BLOCK_COMMENT_END = "#>";
const SINGLE_COMMENT = "#";

/** Strips the trailing #> and everything after it from a block comment opening line. */
function stripBlockEnd(text: string): string {
  const endIdx = text.indexOf(BLOCK_COMMENT_END);
  return endIdx === -1 ? text : text.slice(0, endIdx);
}

/** Handles a line inside a block comment, returning description or undefined. */
function handleBlockLine(trimmed: string): { done: boolean; result: string | undefined } {
  if (trimmed.includes(BLOCK_COMMENT_END)) {
    const desc = trimmed.slice(0, trimmed.indexOf(BLOCK_COMMENT_END)).trim();
    return { done: true, result: desc === "" ? undefined : desc };
  }
  if (!trimmed.startsWith(".") && trimmed !== "") {
    return { done: true, result: trimmed };
  }
  return { done: false, result: undefined };
}

/** Handles a block comment start line, returning inline description if present. */
function handleBlockStart(trimmed: string): string | undefined {
  const afterStart = trimmed.slice(BLOCK_COMMENT_START.length).trim();
  if (afterStart !== "" && !afterStart.startsWith(".")) {
    return stripBlockEnd(afterStart).trim();
  }
  return undefined;
}

/** Extracts description from a single-line # comment, or undefined if not suitable. */
function extractSingleLineDesc(trimmed: string): string | undefined {
  const afterHash = trimmed.slice(SINGLE_COMMENT.length);
  const desc = afterHash.startsWith(" ") ? afterHash.slice(1).trim() : afterHash.trim();
  if (desc === "" || desc.startsWith("@") || desc.startsWith(".")) {
    return undefined;
  }
  return desc;
}

/** Scans lines inside a block comment for the first description line. */
function scanBlockForDescription(lines: readonly string[], startIdx: number): string | undefined {
  const remaining = lines.slice(startIdx);
  for (const line of remaining) {
    const { done, result } = handleBlockLine(line.trim());
    if (done) {
      return result;
    }
  }
  return undefined;
}

/** Scans non-block lines for a description, handling block comment starts. */
function scanOutsideBlock(lines: readonly string[]): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) {
      break;
    }
    const trimmed = line.trim();
    if (trimmed.startsWith(BLOCK_COMMENT_START)) {
      const inlineDesc = handleBlockStart(trimmed);
      if (inlineDesc !== undefined && inlineDesc !== "") {
        return inlineDesc;
      }
      return scanBlockForDescription(lines, i + 1);
    }
    if (trimmed === "") {
      continue;
    }
    if (trimmed.startsWith(SINGLE_COMMENT)) {
      const desc = extractSingleLineDesc(trimmed);
      if (desc !== undefined) {
        return desc;
      }
      continue;
    }
    break;
  }
  return undefined;
}

/**
 * Parses the first comment block as description for PowerShell.
 */
function parsePowerShellDescription(content: string): string | undefined {
  return scanOutsideBlock(content.split("\n"));
}

/**
 * Parses the first REM or :: comment as description for batch files.
 */
function parseBatchDescription(content: string): string | undefined {
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === "") {
      continue;
    }

    // Skip @echo off
    if (trimmed.toLowerCase().startsWith("@echo")) {
      continue;
    }

    // REM comment
    if (trimmed.toLowerCase().startsWith("rem ")) {
      const desc = trimmed.slice(4).trim();
      return desc === "" ? undefined : desc;
    }

    // :: comment
    if (trimmed.startsWith("::")) {
      const desc = trimmed.slice(2).trim();
      return desc === "" ? undefined : desc;
    }

    // Not a comment - stop looking
    break;
  }

  return undefined;
}
