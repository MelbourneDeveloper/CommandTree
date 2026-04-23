import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId, simplifyPath } from "../models/TaskItem";
import { readFileContent } from "../utils/fileUtils";

export const ICON_DEF: IconDef = {
  icon: "symbol-property",
  color: "terminal.ansiGreen",
};
export const CATEGORY_DEF: CategoryDef = {
  type: "gradle",
  label: "Gradle Tasks",
};

/**
 * Discovers Gradle tasks from build.gradle and build.gradle.kts files.
 * Only returns tasks if Java, Kotlin, or Groovy source files exist in the workspace.
 */
export async function discoverGradleTasks(workspaceRoot: string, excludePatterns: string[]): Promise<CommandItem[]> {
  const exclude = `{${excludePatterns.join(",")}}`;

  // Check if any JVM source files exist before processing
  const [javaFiles, kotlinSourceFiles, groovySourceFiles] = await Promise.all([
    vscode.workspace.findFiles("**/*.java", exclude),
    vscode.workspace.findFiles("**/*.kt", exclude),
    vscode.workspace.findFiles("**/*.groovy", exclude),
  ]);
  const totalSourceFiles = javaFiles.length + kotlinSourceFiles.length + groovySourceFiles.length;
  if (totalSourceFiles === 0) {
    return []; // No JVM source code, skip Gradle tasks
  }

  const [groovyFiles, kotlinFiles] = await Promise.all([
    vscode.workspace.findFiles("**/build.gradle", exclude),
    vscode.workspace.findFiles("**/build.gradle.kts", exclude),
  ]);
  const allFiles = [...groovyFiles, ...kotlinFiles];
  const commands: CommandItem[] = [];

  for (const file of allFiles) {
    const content = await readFileContent(file);
    const gradleDir = path.dirname(file.fsPath);
    const category = simplifyPath(file.fsPath, workspaceRoot);
    const parsedTasks = parseGradleTasks(content);

    // Add standard Gradle tasks that are always available
    const standardTasks = ["build", "clean", "test", "assemble", "check"];
    for (const taskName of standardTasks) {
      if (!parsedTasks.includes(taskName)) {
        parsedTasks.push(taskName);
      }
    }

    for (const taskName of parsedTasks) {
      commands.push({
        id: generateCommandId("gradle", file.fsPath, taskName),
        label: taskName,
        type: "gradle",
        category,
        command: `./gradlew ${taskName}`,
        cwd: gradleDir,
        filePath: file.fsPath,
        tags: [],
      });
    }
  }

  return commands;
}

/**
 * Parses Gradle file to extract task names.
 */
function parseGradleTasks(content: string): string[] {
  const tasks: string[] = [];

  // Match task definitions: task taskName { ... } or task('taskName') { ... }
  const taskDefRegex = /task\s*\(?['"]?(\w+)['"]?\)?/g;
  let match;
  while ((match = taskDefRegex.exec(content)) !== null) {
    const task = match[1];
    if (task !== undefined && !tasks.includes(task)) {
      tasks.push(task);
    }
  }

  // Match Kotlin DSL: tasks.register("taskName") or tasks.create("taskName")
  const kotlinTaskRegex = /tasks\.(register|create)\s*\(\s*["'](\w+)["']/g;
  while ((match = kotlinTaskRegex.exec(content)) !== null) {
    const task = match[2];
    if (task !== undefined && !tasks.includes(task)) {
      tasks.push(task);
    }
  }

  return tasks;
}
