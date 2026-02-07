import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import type { Result } from '../models/TaskItem';
import { ok, err } from '../models/TaskItem';

/**
 * Summary record for a single discovered command.
 */
export interface SummaryRecord {
    readonly commandId: string;
    readonly contentHash: string;
    readonly summary: string;
    readonly lastUpdated: string;
}

/**
 * Full summary store data structure.
 */
export interface SummaryStoreData {
    readonly records: Readonly<Record<string, SummaryRecord>>;
}

const STORE_FILENAME = 'commandtree-summaries.json';

/**
 * Computes a content hash for change detection.
 */
export function computeContentHash(content: string): string {
    return crypto
        .createHash('sha256')
        .update(content)
        .digest('hex')
        .substring(0, 16);
}

/**
 * Checks whether a record needs re-summarisation.
 */
export function needsUpdate(
    record: SummaryRecord | undefined,
    currentHash: string
): boolean {
    return record?.contentHash !== currentHash;
}

/**
 * Reads the summary store from disk.
 */
export async function readSummaryStore(
    workspaceRoot: string
): Promise<Result<SummaryStoreData, string>> {
    const storePath = path.join(workspaceRoot, '.vscode', STORE_FILENAME);
    const uri = vscode.Uri.file(storePath);

    try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const content = new TextDecoder().decode(bytes);
        const parsed = JSON.parse(content) as SummaryStoreData;
        return ok(parsed);
    } catch {
        return ok({ records: {} });
    }
}

/**
 * Writes the summary store to disk.
 */
export async function writeSummaryStore(
    workspaceRoot: string,
    data: SummaryStoreData
): Promise<Result<void, string>> {
    const storePath = path.join(workspaceRoot, '.vscode', STORE_FILENAME);
    const uri = vscode.Uri.file(storePath);
    const content = JSON.stringify(data, null, 2);

    try {
        await vscode.workspace.fs.writeFile(
            uri,
            new TextEncoder().encode(content)
        );
        return ok(undefined);
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to write summary store';
        return err(message);
    }
}

/**
 * Creates a new store with an updated record.
 */
export function upsertRecord(
    store: SummaryStoreData,
    record: SummaryRecord
): SummaryStoreData {
    return {
        records: {
            ...store.records,
            [record.commandId]: record
        }
    };
}

/**
 * Looks up a record by command ID.
 */
export function getRecord(
    store: SummaryStoreData,
    commandId: string
): SummaryRecord | undefined {
    return store.records[commandId];
}

/**
 * Gets all records as an array.
 */
export function getAllRecords(store: SummaryStoreData): SummaryRecord[] {
    return Object.values(store.records);
}
