import * as vscode from "vscode";
import type { CommandItem, CommandType, IconDef, CategoryDef } from "../models/TaskItem";
import { discoverShellScripts, ICON_DEF as SHELL_ICON, CATEGORY_DEF as SHELL_CAT } from "./shell";
import { discoverNpmScripts, ICON_DEF as NPM_ICON, CATEGORY_DEF as NPM_CAT } from "./npm";
import { discoverMakeTargets, ICON_DEF as MAKE_ICON, CATEGORY_DEF as MAKE_CAT } from "./make";
import { discoverLaunchConfigs, ICON_DEF as LAUNCH_ICON, CATEGORY_DEF as LAUNCH_CAT } from "./launch";
import { discoverVsCodeTasks, ICON_DEF as VSCODE_ICON, CATEGORY_DEF as VSCODE_CAT } from "./tasks";
import { discoverPythonScripts, ICON_DEF as PYTHON_ICON, CATEGORY_DEF as PYTHON_CAT } from "./python";
import { discoverPowerShellScripts, ICON_DEF as POWERSHELL_ICON, CATEGORY_DEF as POWERSHELL_CAT } from "./powershell";
import { discoverGradleTasks, ICON_DEF as GRADLE_ICON, CATEGORY_DEF as GRADLE_CAT } from "./gradle";
import { discoverCargoTasks, ICON_DEF as CARGO_ICON, CATEGORY_DEF as CARGO_CAT } from "./cargo";
import { discoverMavenGoals, ICON_DEF as MAVEN_ICON, CATEGORY_DEF as MAVEN_CAT } from "./maven";
import { discoverAntTargets, ICON_DEF as ANT_ICON, CATEGORY_DEF as ANT_CAT } from "./ant";
import { discoverJustRecipes, ICON_DEF as JUST_ICON, CATEGORY_DEF as JUST_CAT } from "./just";
import { discoverTaskfileTasks, ICON_DEF as TASKFILE_ICON, CATEGORY_DEF as TASKFILE_CAT } from "./taskfile";
import { discoverDenoTasks, ICON_DEF as DENO_ICON, CATEGORY_DEF as DENO_CAT } from "./deno";
import { discoverRakeTasks, ICON_DEF as RAKE_ICON, CATEGORY_DEF as RAKE_CAT } from "./rake";
import { discoverComposerScripts, ICON_DEF as COMPOSER_ICON, CATEGORY_DEF as COMPOSER_CAT } from "./composer";
import { discoverDockerComposeServices, ICON_DEF as DOCKER_ICON, CATEGORY_DEF as DOCKER_CAT } from "./docker";
import { discoverDotnetProjects, ICON_DEF as DOTNET_ICON, CATEGORY_DEF as DOTNET_CAT } from "./dotnet";
import { discoverMarkdownFiles, ICON_DEF as MARKDOWN_ICON, CATEGORY_DEF as MARKDOWN_CAT } from "./markdown";
import {
  discoverCsharpScripts,
  ICON_DEF as CSHARP_SCRIPT_ICON,
  CATEGORY_DEF as CSHARP_SCRIPT_CAT,
} from "./csharp-script";
import {
  discoverFsharpScripts,
  ICON_DEF as FSHARP_SCRIPT_ICON,
  CATEGORY_DEF as FSHARP_SCRIPT_CAT,
} from "./fsharp-script";
import { discoverMiseTasks, ICON_DEF as MISE_ICON, CATEGORY_DEF as MISE_CAT } from "./mise";
import { logger } from "../utils/logger";

export const ICON_REGISTRY: Record<CommandType, IconDef> = {
  shell: SHELL_ICON,
  npm: NPM_ICON,
  make: MAKE_ICON,
  launch: LAUNCH_ICON,
  vscode: VSCODE_ICON,
  python: PYTHON_ICON,
  powershell: POWERSHELL_ICON,
  gradle: GRADLE_ICON,
  cargo: CARGO_ICON,
  maven: MAVEN_ICON,
  ant: ANT_ICON,
  just: JUST_ICON,
  taskfile: TASKFILE_ICON,
  deno: DENO_ICON,
  rake: RAKE_ICON,
  composer: COMPOSER_ICON,
  docker: DOCKER_ICON,
  dotnet: DOTNET_ICON,
  markdown: MARKDOWN_ICON,
  "csharp-script": CSHARP_SCRIPT_ICON,
  "fsharp-script": FSHARP_SCRIPT_ICON,
  mise: MISE_ICON,
};

export const CATEGORY_DEFS: readonly CategoryDef[] = [
  SHELL_CAT,
  NPM_CAT,
  MAKE_CAT,
  LAUNCH_CAT,
  VSCODE_CAT,
  PYTHON_CAT,
  POWERSHELL_CAT,
  GRADLE_CAT,
  CARGO_CAT,
  MAVEN_CAT,
  ANT_CAT,
  JUST_CAT,
  TASKFILE_CAT,
  DENO_CAT,
  RAKE_CAT,
  COMPOSER_CAT,
  DOCKER_CAT,
  DOTNET_CAT,
  MARKDOWN_CAT,
  CSHARP_SCRIPT_CAT,
  FSHARP_SCRIPT_CAT,
  MISE_CAT,
];

export interface DiscoveryResult {
  shell: CommandItem[];
  npm: CommandItem[];
  make: CommandItem[];
  launch: CommandItem[];
  vscode: CommandItem[];
  python: CommandItem[];
  powershell: CommandItem[];
  gradle: CommandItem[];
  cargo: CommandItem[];
  maven: CommandItem[];
  ant: CommandItem[];
  just: CommandItem[];
  taskfile: CommandItem[];
  deno: CommandItem[];
  rake: CommandItem[];
  composer: CommandItem[];
  docker: CommandItem[];
  dotnet: CommandItem[];
  markdown: CommandItem[];
  "csharp-script": CommandItem[];
  "fsharp-script": CommandItem[];
  mise: CommandItem[];
}

/**
 * Discovers all tasks from all sources.
 */
export async function discoverAllTasks(workspaceRoot: string, excludePatterns: string[]): Promise<DiscoveryResult> {
  logger.info("Discovery started", { workspaceRoot });

  // Run all discoveries in parallel
  const [
    shell,
    npm,
    make,
    launch,
    vscodeTasks,
    python,
    powershell,
    gradle,
    cargo,
    maven,
    ant,
    just,
    taskfile,
    deno,
    rake,
    composer,
    docker,
    dotnet,
    markdown,
    csharpScript,
    fsharpScript,
    mise,
  ] = await Promise.all([
    discoverShellScripts(workspaceRoot, excludePatterns),
    discoverNpmScripts(workspaceRoot, excludePatterns),
    discoverMakeTargets(workspaceRoot, excludePatterns),
    discoverLaunchConfigs(workspaceRoot, excludePatterns),
    discoverVsCodeTasks(workspaceRoot, excludePatterns),
    discoverPythonScripts(workspaceRoot, excludePatterns),
    discoverPowerShellScripts(workspaceRoot, excludePatterns),
    discoverGradleTasks(workspaceRoot, excludePatterns),
    discoverCargoTasks(workspaceRoot, excludePatterns),
    discoverMavenGoals(workspaceRoot, excludePatterns),
    discoverAntTargets(workspaceRoot, excludePatterns),
    discoverJustRecipes(workspaceRoot, excludePatterns),
    discoverTaskfileTasks(workspaceRoot, excludePatterns),
    discoverDenoTasks(workspaceRoot, excludePatterns),
    discoverRakeTasks(workspaceRoot, excludePatterns),
    discoverComposerScripts(workspaceRoot, excludePatterns),
    discoverDockerComposeServices(workspaceRoot, excludePatterns),
    discoverDotnetProjects(workspaceRoot, excludePatterns),
    discoverMarkdownFiles(workspaceRoot, excludePatterns),
    discoverCsharpScripts(workspaceRoot, excludePatterns),
    discoverFsharpScripts(workspaceRoot, excludePatterns),
    discoverMiseTasks(workspaceRoot, excludePatterns),
  ]);

  const result = {
    shell,
    npm,
    make,
    launch,
    vscode: vscodeTasks,
    python,
    powershell,
    gradle,
    cargo,
    maven,
    ant,
    just,
    taskfile,
    deno,
    rake,
    composer,
    docker,
    dotnet,
    markdown,
    "csharp-script": csharpScript,
    "fsharp-script": fsharpScript,
    mise,
  };

  const totalCount =
    shell.length +
    npm.length +
    make.length +
    launch.length +
    vscodeTasks.length +
    python.length +
    powershell.length +
    gradle.length +
    cargo.length +
    maven.length +
    ant.length +
    just.length +
    taskfile.length +
    deno.length +
    rake.length +
    composer.length +
    docker.length +
    dotnet.length +
    markdown.length +
    csharpScript.length +
    fsharpScript.length +
    mise.length;

  logger.info("Discovery complete", { totalCount });

  return result;
}

/**
 * Gets all tasks as a flat array.
 */
export function flattenTasks(result: DiscoveryResult): CommandItem[] {
  return [
    ...result.shell,
    ...result.npm,
    ...result.make,
    ...result.launch,
    ...result.vscode,
    ...result.python,
    ...result.powershell,
    ...result.gradle,
    ...result.cargo,
    ...result.maven,
    ...result.ant,
    ...result.just,
    ...result.taskfile,
    ...result.deno,
    ...result.rake,
    ...result.composer,
    ...result.docker,
    ...result.dotnet,
    ...result.markdown,
    ...result["csharp-script"],
    ...result["fsharp-script"],
    ...result.mise,
  ];
}

/**
 * Gets the default exclude patterns from configuration.
 */
export function getExcludePatterns(): string[] {
  const config = vscode.workspace.getConfiguration("commandtree");
  return config.get<string[]>("excludePatterns") ?? ["**/node_modules/**", "**/bin/**", "**/obj/**", "**/.git/**"];
}
