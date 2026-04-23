/**
 * Centralized runtime state for the CommandTree extension.
 * All mutable global state lives here — no module-level `let` anywhere else.
 * A single `appState` instance owns the DB handle, tree providers, and runner.
 */

import type { DbHandle } from "./db/db";
import type { CommandTreeProvider } from "./CommandTreeProvider";
import type { QuickTasksProvider } from "./QuickTasksProvider";
import type { TaskRunner } from "./runners/TaskRunner";

class AppState {
  public dbHandle: DbHandle | null = null;
  public treeProvider: CommandTreeProvider | undefined = undefined;
  public quickTasksProvider: QuickTasksProvider | undefined = undefined;
  public taskRunner: TaskRunner | undefined = undefined;
  public activated = false;

  public reset(): void {
    this.dbHandle = null;
    this.treeProvider = undefined;
    this.quickTasksProvider = undefined;
    this.taskRunner = undefined;
    this.activated = false;
  }
}

export const appState = new AppState();
