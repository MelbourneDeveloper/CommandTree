import * as vscode from "vscode";

const TASK_FILE_PATTERN =
  "**/{package.json,Makefile,makefile,tasks.json,launch.json,*.sh,*.py,mise.toml,.mise.toml,mise.yaml,.mise.yaml}";
const CONFIG_FILE_PATTERN = "**/.vscode/commandtree.json";
const TASK_DEBOUNCE_MS = 2000;
const CONFIG_DEBOUNCE_MS = 1000;

function createDebouncedWatcher({
  pattern,
  debounceMs,
  onTrigger,
}: {
  readonly pattern: string;
  readonly debounceMs: number;
  readonly onTrigger: () => void;
}): vscode.FileSystemWatcher {
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);
  let timer: NodeJS.Timeout | undefined;
  const handler = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(onTrigger, debounceMs);
  };
  watcher.onDidChange(handler);
  watcher.onDidCreate(handler);
  watcher.onDidDelete(handler);
  return watcher;
}

export function setupFileWatchers({
  context,
  onTaskFileChange,
  onConfigChange,
}: {
  readonly context: vscode.ExtensionContext;
  readonly onTaskFileChange: () => void;
  readonly onConfigChange: () => void;
}): void {
  context.subscriptions.push(
    createDebouncedWatcher({
      pattern: TASK_FILE_PATTERN,
      debounceMs: TASK_DEBOUNCE_MS,
      onTrigger: onTaskFileChange,
    }),
    createDebouncedWatcher({
      pattern: CONFIG_FILE_PATTERN,
      debounceMs: CONFIG_DEBOUNCE_MS,
      onTrigger: onConfigChange,
    })
  );
}
