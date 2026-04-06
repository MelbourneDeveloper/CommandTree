import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, ParamDef, MutableCommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId, simplifyPath } from "../models/TaskItem";
import { readFileContent } from "../utils/fileUtils";

export const ICON_DEF: IconDef = {
  icon: "circuit-board",
  color: "terminal.ansiMagenta",
};
export const CATEGORY_DEF: CategoryDef = {
  type: "dotnet",
  label: ".NET Projects",
};

interface ProjectInfo {
  isTestProject: boolean;
  isExecutable: boolean;
}

interface CreateProjectTasksParams {
  filePath: string;
  projectDir: string;
  category: string;
  projectName: string;
  info: ProjectInfo;
}

const TEST_SDK_PACKAGE = "Microsoft.NET.Test.Sdk";
const TEST_FRAMEWORKS = ["xunit", "nunit", "mstest"];
const EXECUTABLE_OUTPUT_TYPES = ["Exe", "WinExe"];

/**
 * Discovers .NET projects (.csproj, .fsproj) and their available commands.
 */
export async function discoverDotnetProjects(workspaceRoot: string, excludePatterns: string[]): Promise<CommandItem[]> {
  const exclude = `{${excludePatterns.join(",")}}`;
  const [csprojFiles, fsprojFiles] = await Promise.all([
    vscode.workspace.findFiles("**/*.csproj", exclude),
    vscode.workspace.findFiles("**/*.fsproj", exclude),
  ]);
  const allFiles = [...csprojFiles, ...fsprojFiles];
  const commands: CommandItem[] = [];

  for (const file of allFiles) {
    const content = await readFileContent(file);
    const projectInfo = analyzeProject(content);
    const projectDir = path.dirname(file.fsPath);
    const category = simplifyPath(file.fsPath, workspaceRoot);
    const projectName = path.basename(file.fsPath, path.extname(file.fsPath));

    commands.push(
      ...createProjectTasks({ filePath: file.fsPath, projectDir, category, projectName, info: projectInfo })
    );
  }

  return commands;
}

function analyzeProject(content: string): ProjectInfo {
  const isTestProject = content.includes(TEST_SDK_PACKAGE) || TEST_FRAMEWORKS.some((fw) => content.includes(fw));

  const outputTypeMatch = /<OutputType>(.*?)<\/OutputType>/i.exec(content);
  const outputType = outputTypeMatch?.[1]?.trim();
  const isExecutable = outputType !== undefined && EXECUTABLE_OUTPUT_TYPES.includes(outputType);

  return { isTestProject, isExecutable };
}

function createProjectTasks({
  filePath,
  projectDir,
  category,
  projectName,
  info,
}: CreateProjectTasksParams): CommandItem[] {
  const commands: CommandItem[] = [];

  commands.push({
    id: generateCommandId("dotnet", filePath, "build"),
    label: `${projectName}: build`,
    type: "dotnet",
    category,
    command: "dotnet build",
    cwd: projectDir,
    filePath,
    tags: [],
    description: "Build the project",
  });

  if (info.isTestProject) {
    const testTask: MutableCommandItem = {
      id: generateCommandId("dotnet", filePath, "test"),
      label: `${projectName}: test`,
      type: "dotnet",
      category,
      command: "dotnet test",
      cwd: projectDir,
      filePath,
      tags: [],
      description: "Run all tests",
      params: createTestParams(),
    };
    commands.push(testTask);
  } else if (info.isExecutable) {
    const runTask: MutableCommandItem = {
      id: generateCommandId("dotnet", filePath, "run"),
      label: `${projectName}: run`,
      type: "dotnet",
      category,
      command: "dotnet run",
      cwd: projectDir,
      filePath,
      tags: [],
      description: "Run the application",
      params: createRunParams(),
    };
    commands.push(runTask);
  }

  commands.push({
    id: generateCommandId("dotnet", filePath, "clean"),
    label: `${projectName}: clean`,
    type: "dotnet",
    category,
    command: "dotnet clean",
    cwd: projectDir,
    filePath,
    tags: [],
    description: "Clean build outputs",
  });

  return commands;
}

function createRunParams(): ParamDef[] {
  return [
    {
      name: "args",
      description: "Runtime arguments (optional, space-separated)",
      default: "",
      format: "dashdash-args",
    },
  ];
}

function createTestParams(): ParamDef[] {
  return [
    {
      name: "filter",
      description: "Test filter expression (optional, e.g., FullyQualifiedName~MyTest)",
      default: "",
      format: "flag",
      flag: "--filter",
    },
  ];
}
