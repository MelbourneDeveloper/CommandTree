import * as vscode from "vscode";

export const PRIVATE_TASK_URI_SCHEME = "commandtree-private";

const PRIVATE_TASK_COLOR = new vscode.ThemeColor("descriptionForeground");

export class PrivateTaskDecorationProvider implements vscode.FileDecorationProvider {
  public provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (uri.scheme !== PRIVATE_TASK_URI_SCHEME) {
      return undefined;
    }
    return { color: PRIVATE_TASK_COLOR, tooltip: "Private task" };
  }
}

export function buildPrivateTaskUri(taskId: string): vscode.Uri {
  return vscode.Uri.parse(`${PRIVATE_TASK_URI_SCHEME}:/${encodeURIComponent(taskId)}`);
}
