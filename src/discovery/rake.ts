import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, MutableCommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId, simplifyPath } from "../models/TaskItem";
import { readFileContent } from "../utils/fileUtils";

export const ICON_DEF: IconDef = { icon: "ruby", color: "terminal.ansiRed" };
export const CATEGORY_DEF: CategoryDef = { type: "rake", label: "Rake Tasks" };

/**
 * Discovers Rake tasks from Rakefile.
 * Only returns tasks if Ruby source files (.rb) exist in the workspace.
 */
export async function discoverRakeTasks(workspaceRoot: string, excludePatterns: string[]): Promise<CommandItem[]> {
  const exclude = `{${excludePatterns.join(",")}}`;

  // Check if any Ruby source files exist before processing
  const rubyFiles = await vscode.workspace.findFiles("**/*.rb", exclude);
  if (rubyFiles.length === 0) {
    return []; // No Ruby source code, skip Rake tasks
  }

  // Rake supports: Rakefile, rakefile, Rakefile.rb, rakefile.rb
  const [rakefiles, lcRakefiles, rbRakefiles, lcRbRakefiles] = await Promise.all([
    vscode.workspace.findFiles("**/Rakefile", exclude),
    vscode.workspace.findFiles("**/rakefile", exclude),
    vscode.workspace.findFiles("**/Rakefile.rb", exclude),
    vscode.workspace.findFiles("**/rakefile.rb", exclude),
  ]);
  const allFiles = [...rakefiles, ...lcRakefiles, ...rbRakefiles, ...lcRbRakefiles];
  const commands: CommandItem[] = [];

  for (const file of allFiles) {
    const content = await readFileContent(file);
    const rakeDir = path.dirname(file.fsPath);
    const category = simplifyPath(file.fsPath, workspaceRoot);
    const rakeTasks = parseRakeTasks(content);

    for (const rakeTask of rakeTasks) {
      const task: MutableCommandItem = {
        id: generateCommandId("rake", file.fsPath, rakeTask.name),
        label: rakeTask.name,
        type: "rake",
        category,
        command: `rake ${rakeTask.name}`,
        cwd: rakeDir,
        filePath: file.fsPath,
        tags: [],
      };
      if (rakeTask.description !== undefined) {
        task.description = rakeTask.description;
      }
      commands.push(task);
    }
  }

  return commands;
}

interface RakeTask {
  name: string;
  description?: string;
}

/**
 * Parses Rakefile to extract task names and descriptions.
 */
function parseRakeTasks(content: string): RakeTask[] {
  const tasks: RakeTask[] = [];
  const lines = content.split("\n");
  let pendingDesc: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();

    // Match desc "description" or desc 'description'
    const descMatch = /^desc\s+["'](.+)["']/.exec(trimmed);
    if (descMatch !== null) {
      pendingDesc = descMatch[1];
      continue;
    }

    // Match task :name or task :name => [...] or task "name"
    const taskMatch = /^task\s+[:"']?(\w+)[:"']?/.exec(trimmed);
    if (taskMatch !== null) {
      const name = taskMatch[1];
      if (name !== undefined && name !== "") {
        tasks.push({
          name,
          ...(pendingDesc !== undefined && pendingDesc !== "" ? { description: pendingDesc } : {}),
        });
      }
      pendingDesc = undefined;
    }
  }

  return tasks;
}
