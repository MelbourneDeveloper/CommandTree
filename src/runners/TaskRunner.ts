import * as vscode from "vscode";
import type { CommandItem, ParamDef } from "../models/TaskItem";
import { buildCommand } from "./paramFormatting";
import type { ParamValue } from "./paramFormatting";

/**
 * SPEC: command-execution, parameterized-commands
 *
 * Shows error message without blocking (fire and forget).
 */
function showError(message: string): void {
  vscode.window.showErrorMessage(message).then(
    () => {
      /* dismissed */
    },
    () => {
      /* error showing message */
    }
  );
}

/**
 * Execution mode for commands.
 */
export type RunMode = "newTerminal" | "currentTerminal";

// Upper bound on waiting for shell integration to activate. Both SI
// `executeCommand` and `sendText` internally call xterm `scrollToBottom`,
// so the paint delay below applies to both paths (command-execution spec).
const SHELL_INTEGRATION_TIMEOUT_MS = 2000;
// Delay after shell spawn before touching the terminal. xterm lays out on
// DOM paint after `terminal.show()`; on a busy CI host with xvfb this can
// take over a second, so we wait long enough that the viewport and its
// `dimensions` are populated before any send — otherwise xterm's
// `scrollToBottom` throws a TypeError (command-execution spec).
const XTERM_PAINT_DELAY_MS = 1500;

/**
 * Executes commands based on their type.
 */
export class TaskRunner {
  /**
   * Runs a command, prompting for parameters if needed.
   */
  public async run(task: CommandItem, mode: RunMode = "newTerminal"): Promise<void> {
    const params = await this.collectParams(task.params);
    if (params === null) {
      return;
    }
    if (task.type === "launch") {
      await this.runLaunch(task);
      return;
    }
    if (task.type === "vscode") {
      await this.runVsCodeTask(task);
      return;
    }
    if (task.type === "markdown") {
      await this.runMarkdownPreview(task);
      return;
    }
    if (mode === "currentTerminal") {
      this.runInCurrentTerminal(task, params);
    } else {
      this.runInNewTerminal(task, params);
    }
  }

  /**
   * Collects parameter values from user with their definitions.
   */
  private async collectParams(params?: readonly ParamDef[]): Promise<ParamValue[] | null> {
    const collected: ParamValue[] = [];
    if (params === undefined || params.length === 0) {
      return collected;
    }
    for (const param of params) {
      const value = await this.promptForParam(param);
      if (value === undefined) {
        return null;
      }
      collected.push({ def: param, value });
    }
    return collected;
  }

  private async promptForParam(param: ParamDef): Promise<string | undefined> {
    if (param.options !== undefined && param.options.length > 0) {
      return await vscode.window.showQuickPick([...param.options], {
        placeHolder: param.description ?? `Select ${param.name}`,
        title: param.name,
      });
    }
    const inputOptions: vscode.InputBoxOptions = {
      prompt: param.description ?? `Enter ${param.name}`,
      title: param.name,
    };
    if (param.default !== undefined) {
      inputOptions.value = param.default;
    }
    return await vscode.window.showInputBox(inputOptions);
  }

  /**
   * Runs a VS Code debug configuration.
   */
  private async runLaunch(task: CommandItem): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder === undefined) {
      showError("No workspace folder found");
      return;
    }

    const started = await vscode.debug.startDebugging(workspaceFolder, task.command);

    if (!started) {
      showError(`Failed to start: ${task.label}`);
    }
  }

  /**
   * Runs a VS Code task from tasks.json.
   */
  private async runVsCodeTask(task: CommandItem): Promise<void> {
    const allTasks = await vscode.tasks.fetchTasks();
    const matchingTask = allTasks.find((t) => t.name === task.command);

    if (matchingTask !== undefined) {
      await vscode.tasks.executeTask(matchingTask);
    } else {
      showError(`Command not found: ${task.label}`);
    }
  }

  /**
   * Opens a markdown file in preview mode.
   * Uses showPreviewToSide so each run reliably opens a dedicated preview tab
   * instead of reusing an unlocked preview already open for another file.
   */
  private async runMarkdownPreview(task: CommandItem): Promise<void> {
    await vscode.commands.executeCommand("markdown.showPreviewToSide", vscode.Uri.file(task.filePath));
  }

  /**
   * Runs a command in a new terminal.
   */
  private runInNewTerminal(task: CommandItem, params: readonly ParamValue[]): void {
    const command = buildCommand(task.command, params);
    const terminalOptions: vscode.TerminalOptions = {
      name: `CommandTree: ${task.label}`,
    };
    if (task.cwd !== undefined) {
      terminalOptions.cwd = task.cwd;
    }
    const terminal = vscode.window.createTerminal(terminalOptions);
    terminal.show(true);
    this.executeInTerminal(terminal, command);
  }

  /**
   * Runs a command in the current (active) terminal.
   */
  private runInCurrentTerminal(task: CommandItem, params: readonly ParamValue[]): void {
    const command = buildCommand(task.command, params);
    let terminal = vscode.window.activeTerminal;

    if (terminal === undefined) {
      const terminalOptions: vscode.TerminalOptions = {
        name: `CommandTree: ${task.label}`,
      };
      if (task.cwd !== undefined) {
        terminalOptions.cwd = task.cwd;
      }
      terminal = vscode.window.createTerminal(terminalOptions);
    }

    terminal.show(true);

    const fullCommand = task.cwd !== undefined && task.cwd !== "" ? `cd "${task.cwd}" && ${command}` : command;

    this.executeInTerminal(terminal, fullCommand);
  }

  /**
   * Executes a command in a terminal. Always defers the send until the
   * shell process has spawned and the xterm viewport has had time to
   * paint — both shell integration's `executeCommand` and `sendText`
   * internally call xterm `scrollToBottom`, which throws a TypeError if
   * the viewport's `dimensions` are not yet populated
   * (command-execution spec).
   */
  private executeInTerminal(terminal: vscode.Terminal, command: string): void {
    this.executeWhenReady(terminal, command).catch(() => undefined);
  }

  private async executeWhenReady(terminal: vscode.Terminal, command: string): Promise<void> {
    await terminal.processId;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, XTERM_PAINT_DELAY_MS);
    });
    const si = terminal.shellIntegration ?? (await this.awaitShellIntegration(terminal));
    this.safeSendText(terminal, command, si);
  }

  private async awaitShellIntegration(terminal: vscode.Terminal): Promise<vscode.TerminalShellIntegration | undefined> {
    return await new Promise<vscode.TerminalShellIntegration | undefined>((resolve) => {
      let done = false;
      const listener = vscode.window.onDidChangeTerminalShellIntegration(({ terminal: t, shellIntegration }) => {
        if (t === terminal && !done) {
          done = true;
          listener.dispose();
          resolve(shellIntegration);
        }
      });
      setTimeout(() => {
        if (!done) {
          done = true;
          listener.dispose();
          resolve(undefined);
        }
      }, SHELL_INTEGRATION_TIMEOUT_MS);
    });
  }

  /**
   * Sends text to terminal, preferring shell integration when available.
   * Guards against xterm viewport not being initialized (no dimensions).
   */
  private safeSendText(
    terminal: vscode.Terminal,
    command: string,
    shellIntegration?: vscode.TerminalShellIntegration
  ): void {
    try {
      if (shellIntegration !== undefined) {
        shellIntegration.executeCommand(command);
      } else {
        terminal.sendText(command);
      }
    } catch {
      showError(`Failed to send command to terminal: ${command}`);
    }
  }
}
