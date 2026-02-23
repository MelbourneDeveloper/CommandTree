import * as vscode from 'vscode';
import type { TaskItem, TaskType, IconDef } from '../models/TaskItem';
import { discoverShellScripts, ICON_DEF as SHELL_ICON } from './shell';
import { discoverNpmScripts, ICON_DEF as NPM_ICON } from './npm';
import { discoverMakeTargets, ICON_DEF as MAKE_ICON } from './make';
import { discoverLaunchConfigs, ICON_DEF as LAUNCH_ICON } from './launch';
import { discoverVsCodeTasks, ICON_DEF as VSCODE_ICON } from './tasks';
import { discoverPythonScripts, ICON_DEF as PYTHON_ICON } from './python';
import { discoverPowerShellScripts, ICON_DEF as POWERSHELL_ICON } from './powershell';
import { discoverGradleTasks, ICON_DEF as GRADLE_ICON } from './gradle';
import { discoverCargoTasks, ICON_DEF as CARGO_ICON } from './cargo';
import { discoverMavenGoals, ICON_DEF as MAVEN_ICON } from './maven';
import { discoverAntTargets, ICON_DEF as ANT_ICON } from './ant';
import { discoverJustRecipes, ICON_DEF as JUST_ICON } from './just';
import { discoverTaskfileTasks, ICON_DEF as TASKFILE_ICON } from './taskfile';
import { discoverDenoTasks, ICON_DEF as DENO_ICON } from './deno';
import { discoverRakeTasks, ICON_DEF as RAKE_ICON } from './rake';
import { discoverComposerScripts, ICON_DEF as COMPOSER_ICON } from './composer';
import { discoverDockerComposeServices, ICON_DEF as DOCKER_ICON } from './docker';
import { discoverDotnetProjects, ICON_DEF as DOTNET_ICON } from './dotnet';
import { discoverMarkdownFiles, ICON_DEF as MARKDOWN_ICON } from './markdown';
import { logger } from '../utils/logger';

export const ICON_REGISTRY: Record<TaskType, IconDef> = {
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
};

export interface DiscoveryResult {
    shell: TaskItem[];
    npm: TaskItem[];
    make: TaskItem[];
    launch: TaskItem[];
    vscode: TaskItem[];
    python: TaskItem[];
    powershell: TaskItem[];
    gradle: TaskItem[];
    cargo: TaskItem[];
    maven: TaskItem[];
    ant: TaskItem[];
    just: TaskItem[];
    taskfile: TaskItem[];
    deno: TaskItem[];
    rake: TaskItem[];
    composer: TaskItem[];
    docker: TaskItem[];
    dotnet: TaskItem[];
    markdown: TaskItem[];
}

/**
 * Discovers all tasks from all sources.
 */
export async function discoverAllTasks(
    workspaceRoot: string,
    excludePatterns: string[]
): Promise<DiscoveryResult> {
    logger.info('Discovery started', { workspaceRoot, excludePatterns });

    // Run all discoveries in parallel
    const [
        shell, npm, make, launch, vscodeTasks, python,
        powershell, gradle, cargo, maven, ant, just,
        taskfile, deno, rake, composer, docker, dotnet, markdown
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
        discoverMarkdownFiles(workspaceRoot, excludePatterns)
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
        markdown
    };

    const totalCount = shell.length + npm.length + make.length + launch.length +
        vscodeTasks.length + python.length + powershell.length + gradle.length +
        cargo.length + maven.length + ant.length + just.length + taskfile.length +
        deno.length + rake.length + composer.length + docker.length + dotnet.length +
        markdown.length;

    logger.info('Discovery complete', {
        totalCount,
        shell: shell.length,
        npm: npm.length,
        make: make.length,
        launch: launch.length,
        vscode: vscodeTasks.length,
        python: python.length,
        dotnet: dotnet.length,
        shellTaskIds: shell.map(t => t.id)
    });

    return result;
}

/**
 * Gets all tasks as a flat array.
 */
export function flattenTasks(result: DiscoveryResult): TaskItem[] {
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
        ...result.markdown
    ];
}

/**
 * Gets the default exclude patterns from configuration.
 */
export function getExcludePatterns(): string[] {
    const config = vscode.workspace.getConfiguration('commandtree');
    return config.get<string[]>('excludePatterns') ?? [
        '**/node_modules/**',
        '**/bin/**',
        '**/obj/**',
        '**/.git/**'
    ];
}
