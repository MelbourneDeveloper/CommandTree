import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, ParamDef, MutableCommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId, simplifyPath } from "../models/TaskItem";
import { readFileContent } from "../utils/fileUtils";

export const ICON_DEF: IconDef = {
  icon: "symbol-misc",
  color: "terminal.ansiCyan",
};
export const CATEGORY_DEF: CategoryDef = {
  type: "python",
  label: "Python Scripts",
};

/**
 * SPEC: command-discovery/python-scripts
 *
 * Discovers Python scripts (.py files) in the workspace.
 */
export async function discoverPythonScripts(workspaceRoot: string, excludePatterns: string[]): Promise<CommandItem[]> {
  const exclude = `{${excludePatterns.join(",")}}`;
  const files = await vscode.workspace.findFiles("**/*.py", exclude);
  const commands: CommandItem[] = [];

  for (const file of files) {
    const content = await readFileContent(file);

    // Skip non-runnable Python files (no main block or shebang)
    if (!isRunnablePythonScript(content)) {
      continue;
    }

    const name = path.basename(file.fsPath);
    const params = parsePythonParams(content);
    const description = parsePythonDescription(content);

    const task: MutableCommandItem = {
      id: generateCommandId("python", file.fsPath, name),
      label: name,
      type: "python",
      category: simplifyPath(file.fsPath, workspaceRoot),
      command: file.fsPath,
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

/**
 * Checks if a Python file is runnable (has shebang or __main__ block).
 */
function isRunnablePythonScript(content: string): boolean {
  if (content.startsWith("#!") && content.includes("python")) {
    return true;
  }
  return hasMainBlock(content);
}

function hasMainBlock(content: string): boolean {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("if")) {
      continue;
    }
    if (!trimmed.includes("__name__")) {
      continue;
    }
    if (!trimmed.includes("__main__")) {
      continue;
    }
    if (trimmed.includes("==")) {
      return true;
    }
  }
  return false;
}

/**
 * Parses Python docstrings/comments for parameter hints.
 * Supports: # @param name Description
 * Also supports argparse-style: parser.add_argument('--name', help='Description')
 */
function parsePythonParams(content: string): ParamDef[] {
  const params: ParamDef[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    const commentParam = parseCommentParam(trimmed);
    if (commentParam !== undefined) {
      params.push(commentParam);
      continue;
    }
    const argParam = parseArgparseParam(trimmed);
    if (argParam !== undefined && !params.some((p) => p.name === argParam.name)) {
      params.push(argParam);
    }
  }
  return params;
}

function parseCommentParam(trimmed: string): ParamDef | undefined {
  if (!trimmed.startsWith("#")) {
    return undefined;
  }
  const withoutHash = trimmed.slice(1).trim();
  if (!withoutHash.startsWith("@param")) {
    return undefined;
  }
  const afterTag = withoutHash.slice("@param".length).trim();
  const spaceIdx = afterTag.indexOf(" ");
  if (spaceIdx < 0) {
    return undefined;
  }
  const paramName = afterTag.slice(0, spaceIdx);
  const descText = afterTag.slice(spaceIdx + 1);
  return buildParamWithDefault(paramName, descText);
}

function buildParamWithDefault(name: string, descText: string): ParamDef {
  const defaultVal = extractDefault(descText);
  const cleanDesc = removeDefaultAnnotation(descText).trim();
  return {
    name,
    description: cleanDesc,
    ...(defaultVal !== undefined && defaultVal !== "" ? { default: defaultVal } : {}),
  };
}

function extractDefault(text: string): string | undefined {
  const marker = "(default:";
  const start = text.toLowerCase().indexOf(marker);
  if (start < 0) {
    return undefined;
  }
  const end = text.indexOf(")", start + marker.length);
  if (end < 0) {
    return undefined;
  }
  return text.slice(start + marker.length, end).trim();
}

function removeDefaultAnnotation(text: string): string {
  const marker = "(default:";
  const start = text.toLowerCase().indexOf(marker);
  if (start < 0) {
    return text;
  }
  const end = text.indexOf(")", start + marker.length);
  if (end < 0) {
    return text;
  }
  return (text.slice(0, start) + text.slice(end + 1)).trim();
}

function parseArgparseParam(trimmed: string): ParamDef | undefined {
  const marker = "add_argument(";
  const idx = trimmed.indexOf(marker);
  if (idx < 0) {
    return undefined;
  }
  const argsStr = trimmed.slice(idx + marker.length);
  const argName = extractArgName(argsStr);
  if (argName === undefined) {
    return undefined;
  }
  const helpText = extractHelpText(argsStr);
  return {
    name: argName,
    ...(helpText !== undefined && helpText !== "" ? { description: helpText } : {}),
  };
}

function extractArgName(argsStr: string): string | undefined {
  const firstQuote = findQuoteStart(argsStr);
  if (firstQuote < 0) {
    return undefined;
  }
  const quote = argsStr.charAt(firstQuote);
  const endQuote = argsStr.indexOf(quote, firstQuote + 1);
  if (endQuote < 0) {
    return undefined;
  }
  const raw = argsStr.slice(firstQuote + 1, endQuote);
  return stripLeadingDashes(raw);
}

function findQuoteStart(s: string): number {
  const single = s.indexOf("'");
  const double = s.indexOf('"');
  if (single < 0) {
    return double;
  }
  if (double < 0) {
    return single;
  }
  return Math.min(single, double);
}

function stripLeadingDashes(s: string): string {
  let i = 0;
  while (i < s.length && s[i] === "-") {
    i++;
  }
  return s.slice(i);
}

function extractHelpText(argsStr: string): string | undefined {
  const helpIdx = argsStr.indexOf("help=");
  if (helpIdx < 0) {
    return undefined;
  }
  const afterHelp = argsStr.slice(helpIdx + "help=".length);
  const quoteStart = findQuoteStart(afterHelp);
  if (quoteStart < 0) {
    return undefined;
  }
  const quote = afterHelp.charAt(quoteStart);
  const endQuote = afterHelp.indexOf(quote, quoteStart + 1);
  if (endQuote < 0) {
    return undefined;
  }
  return afterHelp.slice(quoteStart + 1, endQuote);
}

/**
 * Parses the module docstring or first comment line as description.
 */
function parsePythonDescription(content: string): string | undefined {
  const lines = content.split("\n");
  const meaningful = skipPreambleLines(lines);
  return parseDescriptionFromLines(meaningful);
}

function skipPreambleLines(lines: readonly string[]): string[] {
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (isSkippablePreamble(trimmed)) {
      continue;
    }
    if (trimmed === "" && result.length === 0) {
      continue;
    }
    result.push(trimmed);
  }
  return result;
}

function parseDescriptionFromLines(lines: readonly string[]): string | undefined {
  let inDocstring = false;
  let docstringQuote = "";

  for (const trimmed of lines) {
    if (trimmed === "") {
      continue;
    }
    if (inDocstring) {
      return resolveDocstringLine(trimmed, docstringQuote);
    }

    const docResult = tryParseDocstringStart(trimmed);
    if (docResult !== undefined) {
      if (docResult.description !== undefined) {
        return docResult.description;
      }
      inDocstring = true;
      docstringQuote = docResult.quote;
      continue;
    }

    if (trimmed.startsWith("#")) {
      return extractCommentDescription(trimmed);
    }
    break;
  }
  return undefined;
}

interface DocstringStart {
  readonly quote: string;
  readonly description: string | undefined;
}

function tryParseDocstringStart(trimmed: string): DocstringStart | undefined {
  const tripleQuote = detectTripleQuote(trimmed);
  if (tripleQuote === undefined) {
    return undefined;
  }
  const singleLine = parseSingleLineDocstring(trimmed, tripleQuote);
  if (singleLine !== undefined) {
    return { quote: tripleQuote, description: singleLine };
  }
  const firstLine = trimmed.slice(3).trim();
  const desc = firstLine !== "" ? firstLine : undefined;
  return { quote: tripleQuote, description: desc };
}

function isSkippablePreamble(trimmed: string): boolean {
  return trimmed.startsWith("#!") || trimmed.startsWith("# -*-") || trimmed.startsWith("# coding");
}

function detectTripleQuote(trimmed: string): string | undefined {
  if (trimmed.startsWith('"""')) {
    return '"""';
  }
  if (trimmed.startsWith("'''")) {
    return "'''";
  }
  return undefined;
}

function parseSingleLineDocstring(trimmed: string, quote: string): string | undefined {
  if (trimmed.length > 6 && trimmed.endsWith(quote)) {
    return trimmed.slice(3, -3).trim();
  }
  return undefined;
}

function resolveDocstringLine(trimmed: string, docstringQuote: string): string | undefined {
  if (trimmed.includes(docstringQuote)) {
    const idx = trimmed.indexOf(docstringQuote);
    const desc = (trimmed.slice(0, idx) + trimmed.slice(idx + docstringQuote.length)).trim();
    return desc === "" ? undefined : desc;
  }
  return trimmed !== "" ? trimmed : undefined;
}

function extractCommentDescription(trimmed: string): string | undefined {
  let afterHash = trimmed.slice(1);
  if (afterHash.startsWith(" ")) {
    afterHash = afterHash.slice(1);
  }
  const desc = afterHash.trim();
  if (desc.startsWith("@") || desc === "") {
    return undefined;
  }
  return desc;
}
