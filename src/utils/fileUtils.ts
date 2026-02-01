import * as vscode from 'vscode';
import type { Result } from '../models/TaskItem';
import { ok, err } from '../models/TaskItem';

/**
 * Reads a file and returns its content as a string.
 * Returns Err on failure instead of throwing.
 */
export async function readFile(uri: vscode.Uri): Promise<Result<string, string>> {
    try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        return ok(new TextDecoder().decode(bytes));
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error reading file';
        return err(message);
    }
}

/**
 * Parses JSON safely, returning a Result instead of throwing.
 */
export function parseJson<T>(content: string): Result<T, string> {
    try {
        return ok(JSON.parse(content) as T);
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Invalid JSON';
        return err(message);
    }
}

/**
 * Removes single-line and multi-line comments from JSONC.
 */
export function removeJsonComments(content: string): string {
    let result = content.replace(/\/\/.*$/gm, '');
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
    return result;
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
