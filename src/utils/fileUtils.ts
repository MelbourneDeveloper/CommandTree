import * as vscode from "vscode";
import type { Result } from "../models/TaskItem";
import { ok, err } from "../models/TaskItem";

/**
 * Reads a file and returns its content as a string.
 * Returns Err on failure instead of throwing.
 */
export async function readFile(uri: vscode.Uri): Promise<Result<string, string>> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return ok(new TextDecoder().decode(bytes));
  } catch (e) {
    return err((e as Error).message);
  }
}

/**
 * Parses JSON safely, returning a Result instead of throwing.
 */
export function parseJson<T>(content: string): Result<T, string> {
  try {
    return ok(JSON.parse(content) as T);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid JSON";
    return err(message);
  }
}

interface ParserState {
  readonly content: string;
  readonly out: string[];
  pos: number;
  inString: boolean;
}

/**
 * Handles one character while inside a JSON string literal.
 * Returns true if the character was consumed (caller should continue).
 */
function handleStringChar(state: ParserState): boolean {
  if (!state.inString) {
    return false;
  }
  const ch = state.content.charAt(state.pos);
  state.out.push(ch);
  if (ch === "\\") {
    state.out.push(state.content.charAt(state.pos + 1));
    state.pos += 2;
    return true;
  }
  if (ch === '"') {
    state.inString = false;
  }
  state.pos++;
  return true;
}

/**
 * Handles one character outside a string: comments or literals.
 */
function handleNonStringChar(state: ParserState): void {
  const ch = state.content.charAt(state.pos);
  const next = state.content.charAt(state.pos + 1);

  if (ch === '"') {
    state.inString = true;
    state.out.push(ch);
    state.pos++;
    return;
  }
  if (ch === "/" && next === "/") {
    state.pos = skipUntilNewline(state.content, state.pos);
    return;
  }
  if (ch === "/" && next === "*") {
    state.pos = skipUntilBlockEnd(state.content, state.pos);
    return;
  }
  state.out.push(ch);
  state.pos++;
}

/**
 * Removes single-line and multi-line comments from JSONC.
 * Uses a character-by-character state machine (no regex).
 */
export function removeJsonComments(content: string): string {
  const state: ParserState = { content, out: [], pos: 0, inString: false };
  while (state.pos < content.length) {
    if (!handleStringChar(state)) {
      handleNonStringChar(state);
    }
  }
  return state.out.join("");
}

function skipUntilNewline(content: string, start: number): number {
  let i = start + 2;
  while (i < content.length && content[i] !== "\n") {
    i++;
  }
  return i;
}

/**
 * Extracts description from the first non-empty line-comment in file content.
 */
export function parseFirstLineComment(content: string, commentPrefix: string): string | undefined {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }
    if (trimmed.startsWith(commentPrefix)) {
      const desc = trimmed.slice(commentPrefix.length).trim();
      return desc === "" ? undefined : desc;
    }
    break;
  }
  return undefined;
}

function skipUntilBlockEnd(content: string, start: number): number {
  let i = start + 2;
  while (i < content.length) {
    if (content[i] === "*" && content[i + 1] === "/") {
      return i + 2;
    }
    i++;
  }
  return i;
}

/**
 * Reads and parses a JSON file, handling JSONC comments.
 * Returns Err on read or parse failure.
 */
export async function readJsonFile<T>(uri: vscode.Uri): Promise<Result<T, string>> {
  const contentResult = await readFile(uri);
  if (!contentResult.ok) {
    return contentResult;
  }

  const cleanJson = removeJsonComments(contentResult.value);
  return parseJson<T>(cleanJson);
}
