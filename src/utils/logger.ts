import * as vscode from "vscode";

/**
 * Diagnostic logger for CommandTree extension
 * Outputs to VS Code's Output Channel for debugging
 */
class Logger {
  private readonly channel: vscode.OutputChannel;
  private enabled = true;

  constructor() {
    this.channel = vscode.window.createOutputChannel("CommandTree Debug");
  }

  /**
   * Enables or disables logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Shows the output channel
   */
  show(): void {
    this.channel.show();
  }

  /**
   * Logs an info message
   */
  info(message: string, data?: unknown): void {
    if (!this.enabled) {
      return;
    }
    const timestamp = new Date().toISOString();
    const logLine =
      data !== undefined
        ? `[${timestamp}] INFO: ${message} | ${JSON.stringify(data)}`
        : `[${timestamp}] INFO: ${message}`;
    this.channel.appendLine(logLine);
  }

  /**
   * Logs a warning message
   */
  warn(message: string, data?: unknown): void {
    if (!this.enabled) {
      return;
    }
    const timestamp = new Date().toISOString();
    const logLine =
      data !== undefined
        ? `[${timestamp}] WARN: ${message} | ${JSON.stringify(data)}`
        : `[${timestamp}] WARN: ${message}`;
    this.channel.appendLine(logLine);
  }

  /**
   * Logs an error message
   */
  error(message: string, data?: unknown): void {
    if (!this.enabled) {
      return;
    }
    const timestamp = new Date().toISOString();
    const logLine =
      data !== undefined
        ? `[${timestamp}] ERROR: ${message} | ${JSON.stringify(data)}`
        : `[${timestamp}] ERROR: ${message}`;
    this.channel.appendLine(logLine);
  }

  /**
   * Logs filter operations
   */
  filter(operation: string, details: Record<string, unknown>): void {
    if (!this.enabled) {
      return;
    }
    const timestamp = new Date().toISOString();
    const detailsStr = JSON.stringify(details);
    this.channel.appendLine(
      `[${timestamp}] FILTER: ${operation} | ${detailsStr}`,
    );
  }

}

// Singleton instance
export const logger = new Logger();
