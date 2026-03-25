/**
 * VS Code adapter implementations for production use.
 * These wrap VS Code APIs to match the adapter interfaces.
 */

import * as vscode from 'vscode';
import type { FileSystemAdapter } from './adapters';
import type { Result } from '../models/Result';
import { ok, err } from '../models/Result';

/**
 * Creates a VS Code-based file system adapter for production use.
 */
export function createVSCodeFileSystem(): FileSystemAdapter {
    return {
        readFile: async (filePath: string): Promise<Result<string, string>> => {
            try {
                const uri = vscode.Uri.file(filePath);
                const bytes = await vscode.workspace.fs.readFile(uri);
                const content = new TextDecoder().decode(bytes);
                return ok(content);
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Read failed';
                return err(msg);
            }
        },
    };
}
