/**
 * SPEC: ai-summary-generation
 *
 * Summary pipeline: generates Copilot summaries and stores them in SQLite.
 */

import type * as vscode from "vscode";
import type { CommandItem } from "../models/TaskItem";
import { ok, err } from "../models/Result";
import type { Result } from "../models/Result";
import { logger } from "../utils/logger";
import { computeContentHash } from "../db/db";
import type { FileSystemAdapter } from "./adapters";
import type { SummaryResult } from "./summariser";
import { selectCopilotModel, summariseScript } from "./summariser";
import { initDb, getDb } from "../db/lifecycle";
import { upsertSummary, getRow, registerCommand } from "../db/db";
import type { DbHandle } from "../db/db";

const MAX_CONSECUTIVE_FAILURES = 3;

interface PendingItem {
  readonly task: CommandItem;
  readonly content: string;
  readonly hash: string;
}

/**
 * Reads script content for a task using the provided file system adapter.
 */
async function readTaskContent(params: {
  readonly task: CommandItem;
  readonly fs: FileSystemAdapter;
}): Promise<string> {
  const result = await params.fs.readFile(params.task.filePath);
  return result.ok ? result.value : params.task.command;
}

/**
 * Finds tasks that need a new or updated summary.
 */
async function findPendingSummaries(params: {
  readonly handle: DbHandle;
  readonly tasks: readonly CommandItem[];
  readonly fs: FileSystemAdapter;
}): Promise<PendingItem[]> {
  const pending: PendingItem[] = [];
  for (const task of params.tasks) {
    const content = await readTaskContent({ task, fs: params.fs });
    const hash = computeContentHash(content);
    const existing = getRow({ handle: params.handle, commandId: task.id });
    const needsSummary = existing === undefined || existing.summary === "" || existing.contentHash !== hash;
    if (needsSummary) {
      pending.push({ task, content, hash });
    }
  }
  return pending;
}

/**
 * Gets a summary for a task via Copilot.
 * NO FALLBACK. If Copilot is unavailable, returns null.
 */
async function getSummary(params: {
  readonly model: vscode.LanguageModelChat;
  readonly task: CommandItem;
  readonly content: string;
}): Promise<SummaryResult | null> {
  const result = await summariseScript({
    model: params.model,
    label: params.task.label,
    type: params.task.type,
    command: params.task.command,
    content: params.content,
  });
  return result.ok ? result.value : null;
}

/**
 * Summarises a single task and stores the summary in SQLite.
 */
async function processOneSummary(params: {
  readonly model: vscode.LanguageModelChat;
  readonly task: CommandItem;
  readonly content: string;
  readonly hash: string;
  readonly handle: DbHandle;
}): Promise<Result<void, string>> {
  const result = await getSummary(params);
  if (result === null) {
    return err("Copilot summary failed");
  }

  const warning = result.securityWarning === "" ? null : result.securityWarning;
  upsertSummary({
    handle: params.handle,
    commandId: params.task.id,
    contentHash: params.hash,
    summary: result.summary,
    securityWarning: warning,
  });
  return ok(undefined);
}

/**
 * Registers all discovered commands in SQLite with their content hashes.
 * Does NOT require Copilot. Preserves existing summaries.
 */
export async function registerAllCommands(params: {
  readonly tasks: readonly CommandItem[];
  readonly workspaceRoot: string;
  readonly fs: FileSystemAdapter;
}): Promise<Result<number, string>> {
  const initResult = await initDb(params.workspaceRoot);
  if (!initResult.ok) {
    return err(initResult.error);
  }
  const handle = initResult.value;

  let registered = 0;
  for (const task of params.tasks) {
    const content = await readTaskContent({ task, fs: params.fs });
    const hash = computeContentHash(content);
    registerCommand({
      handle,
      commandId: task.id,
      contentHash: hash,
    });
    registered++;
  }
  return ok(registered);
}

interface BatchState {
  succeeded: number;
  failed: number;
  aborted: boolean;
}

/**
 * Processes one pending item and updates the batch state.
 */
async function processPendingItem(params: {
  readonly item: PendingItem;
  readonly model: vscode.LanguageModelChat;
  readonly handle: DbHandle;
  readonly state: BatchState;
}): Promise<void> {
  const result = await processOneSummary({
    model: params.model,
    task: params.item.task,
    content: params.item.content,
    hash: params.item.hash,
    handle: params.handle,
  });
  if (result.ok) {
    params.state.succeeded++;
    return;
  }
  params.state.failed++;
  logger.error("[SUMMARY] Task failed", {
    id: params.item.task.id,
    error: result.error,
  });
  if (params.state.failed >= MAX_CONSECUTIVE_FAILURES) {
    logger.error("[SUMMARY] Too many failures, aborting", { failed: params.state.failed });
    params.state.aborted = true;
  }
}

/**
 * Summarises all tasks that are new or have changed content.
 * Stores summaries in SQLite.
 * Commands are registered in DB BEFORE Copilot is contacted.
 */
export async function summariseAllTasks(params: {
  readonly tasks: readonly CommandItem[];
  readonly workspaceRoot: string;
  readonly fs: FileSystemAdapter;
  readonly onProgress?: (done: number, total: number, label: string) => void;
}): Promise<Result<number, string>> {
  // Step 1: Always register commands in DB (independent of Copilot)
  const regResult = await registerAllCommands(params);
  if (!regResult.ok) {
    logger.error("[SUMMARY] registerAllCommands failed", { error: regResult.error });
    return err(regResult.error);
  }

  // Step 2: Try Copilot — if unavailable, commands are still in DB
  const modelResult = await selectCopilotModel();
  if (!modelResult.ok) {
    logger.error("[SUMMARY] Copilot model selection failed", { error: modelResult.error });
    return err(modelResult.error);
  }

  const dbResult = getDb();
  if (!dbResult.ok) {
    return err(dbResult.error);
  }
  const handle = dbResult.value;

  const pending = await findPendingSummaries({
    handle,
    tasks: params.tasks,
    fs: params.fs,
  });
  if (pending.length === 0) {
    logger.info("[SUMMARY] All summaries up to date");
    return ok(0);
  }

  const state: BatchState = { succeeded: 0, failed: 0, aborted: false };
  for (const item of pending) {
    await processPendingItem({ item, model: modelResult.value, handle, state });
    params.onProgress?.(state.succeeded + state.failed, pending.length, item.task.label);
    if (state.aborted) {
      break;
    }
  }

  logger.info("[SUMMARY] complete", { succeeded: state.succeeded, failed: state.failed });
  if (state.succeeded === 0 && state.failed > 0) {
    return err(`All ${state.failed} tasks failed to summarise`);
  }
  return ok(state.succeeded);
}
