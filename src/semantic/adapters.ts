/**
 * SPEC: ai-summary-generation
 *
 * Adapter interfaces for decoupling summary providers from VS Code.
 * Allows unit testing without VS Code instance.
 */

import type { Result } from '../models/Result';

/**
 * File system operations abstraction.
 * Implementations: VSCodeFileSystem (production), NodeFileSystem (unit tests)
 */
export interface FileSystemAdapter {
    readFile: (path: string) => Promise<Result<string, string>>;
}
