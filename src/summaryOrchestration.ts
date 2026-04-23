/**
 * SPEC: SPEC-AI-010, SPEC-AI-030
 * Coordinates automatic and user-triggered AI summary runs.
 */
import * as vscode from "vscode";
import type { CommandTreeProvider } from "./CommandTreeProvider";
import type { QuickTasksProvider } from "./QuickTasksProvider";
import type { Result } from "./models/Result";
import { ok } from "./models/Result";
import { logger } from "./utils/logger";
import { summariseAllTasks, registerAllCommands } from "./semantic/summaryPipeline";
import { createVSCodeFileSystem } from "./semantic/vscodeAdapters";
import type { ModelSelectionMode } from "./semantic/summariser";

export interface SummaryDeps {
  readonly workspaceRoot: string;
  readonly treeProvider: CommandTreeProvider;
  readonly quickTasksProvider: QuickTasksProvider;
}

interface RunSummaryParams extends SummaryDeps {
  readonly modelSelectionMode?: ModelSelectionMode | undefined;
}

function aiSummariesEnabled(): boolean {
  const aiConfig = vscode.workspace.getConfiguration("commandtree").get<boolean>("enableAiSummaries");
  return aiConfig !== false;
}

async function refreshSummaryViews(params: SummaryDeps): Promise<void> {
  await params.treeProvider.refresh();
  params.quickTasksProvider.updateTasks(params.treeProvider.getAllTasks());
}

async function summariseCurrentTasks(params: RunSummaryParams): Promise<Result<number, string>> {
  const tasks = params.treeProvider.getAllTasks();
  logger.info("[SUMMARY] Starting", { taskCount: tasks.length });
  if (tasks.length === 0) {
    logger.warn("[SUMMARY] No tasks to summarise");
    return ok(0);
  }
  return await summariseAllTasks({
    tasks,
    workspaceRoot: params.workspaceRoot,
    fs: createVSCodeFileSystem(),
    modelSelectionMode: params.modelSelectionMode,
    onProgress: (done, total, label) => {
      logger.info(`[SUMMARY] ${label}`, { done, total });
    },
  });
}

export async function registerDiscoveredCommands(params: SummaryDeps): Promise<void> {
  const tasks = params.treeProvider.getAllTasks();
  if (tasks.length === 0) {
    return;
  }
  const result = await registerAllCommands({
    tasks,
    workspaceRoot: params.workspaceRoot,
    fs: createVSCodeFileSystem(),
  });
  if (!result.ok) {
    logger.warn("Command registration failed", { error: result.error });
    return;
  }
  logger.info("Commands registered in DB", { count: result.value });
}

export function initAiSummaries(params: SummaryDeps): void {
  if (!aiSummariesEnabled()) {
    return;
  }
  vscode.commands.executeCommand("setContext", "commandtree.aiSummariesEnabled", true);
  runSummarisation({ ...params, modelSelectionMode: "automatic" }).catch((e: unknown) => {
    logger.error("AI summarisation failed", {
      error: e instanceof Error ? e.message : "Unknown",
    });
  });
}

export async function runSummarisation(params: RunSummaryParams): Promise<void> {
  const summaryResult = await summariseCurrentTasks(params);
  if (!summaryResult.ok) {
    logger.error("Summary pipeline failed", { error: summaryResult.error });
    vscode.window.showErrorMessage(`CommandTree: Summary failed — ${summaryResult.error}`);
    return;
  }
  if (summaryResult.value > 0) {
    await refreshSummaryViews(params);
  }
  vscode.window.showInformationMessage(`CommandTree: Summarised ${summaryResult.value} commands`);
}

export async function syncAndSummarise(params: SummaryDeps): Promise<void> {
  await params.treeProvider.refresh();
  params.quickTasksProvider.updateTasks(params.treeProvider.getAllTasks());
  await registerDiscoveredCommands(params);
  if (aiSummariesEnabled()) {
    await runSummarisation({ ...params, modelSelectionMode: "automatic" });
  }
}
