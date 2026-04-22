import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId, simplifyPath } from "../models/TaskItem";
import { readFileContent } from "../utils/fileUtils";

const DOCKERFILE_BUILD_LABEL = "build Dockerfile";
const DOCKERFILE_BUILD_DESCRIPTION = "Build Docker image";
const COMPOSE_FILE_GLOBS = ["**/docker-compose.yml", "**/docker-compose.yaml", "**/compose.yml", "**/compose.yaml"];
const DOCKERFILE_GLOBS = ["**/Dockerfile", "**/Dockerfile.*"];
const QUOTE_CHAR = '"';

export const ICON_DEF: IconDef = {
  icon: "server-environment",
  color: "terminal.ansiBlue",
};
export const CATEGORY_DEF: CategoryDef = {
  type: "docker",
  label: "Docker Compose",
};

/**
 * Discovers executable Docker Compose and Dockerfile commands.
 */
export async function discoverDockerComposeServices(
  workspaceRoot: string,
  excludePatterns: string[]
): Promise<CommandItem[]> {
  const exclude = `{${excludePatterns.join(",")}}`;
  const [composeFiles, dockerFiles] = await Promise.all([
    findFiles(COMPOSE_FILE_GLOBS, exclude),
    findFiles(DOCKERFILE_GLOBS, exclude),
  ]);
  const composeCommands = await discoverComposeCommands({ files: composeFiles, workspaceRoot });
  const dockerfileCommands = dockerFiles.map((file) => buildDockerfileTask(file, workspaceRoot));
  return [...composeCommands, ...dockerfileCommands];
}

interface ComposeCommandDef {
  readonly name: string;
  readonly args: string;
  readonly description: string;
}

const GENERAL_COMPOSE_COMMANDS: readonly ComposeCommandDef[] = [
  { name: "up", args: "up", description: "Start all services" },
  { name: "up -d", args: "up -d", description: "Start in background" },
  { name: "down", args: "down", description: "Stop all services" },
  { name: "build", args: "build", description: "Build all services" },
  { name: "logs", args: "logs -f", description: "View logs" },
  { name: "ps", args: "ps", description: "List containers" },
];

async function findFiles(globs: readonly string[], exclude: string): Promise<vscode.Uri[]> {
  const groups = await Promise.all(globs.map(async (glob) => await vscode.workspace.findFiles(glob, exclude)));
  return groups.flat();
}

async function discoverComposeCommands(params: {
  readonly files: readonly vscode.Uri[];
  readonly workspaceRoot: string;
}): Promise<CommandItem[]> {
  const groups = await Promise.all(
    params.files.map(async (file) => await buildComposeTasks(file, params.workspaceRoot))
  );
  return groups.flat();
}

async function buildComposeTasks(file: vscode.Uri, workspaceRoot: string): Promise<CommandItem[]> {
  const content = await readFileContent(file);
  const services = parseDockerComposeServices(content);
  const params = createDockerTaskParams(file, workspaceRoot);
  return [...buildGeneralComposeTasks(params), ...buildServiceComposeTasks({ ...params, services })];
}

function createDockerTaskParams(file: vscode.Uri, workspaceRoot: string): DockerTaskParams {
  return {
    filePath: file.fsPath,
    dockerDir: path.dirname(file.fsPath),
    category: simplifyPath(file.fsPath, workspaceRoot),
  };
}

interface DockerTaskParams {
  readonly filePath: string;
  readonly dockerDir: string;
  readonly category: string;
}

function buildGeneralComposeTasks(params: DockerTaskParams): CommandItem[] {
  return GENERAL_COMPOSE_COMMANDS.map((def) =>
    buildComposeTask({ ...params, name: def.name, args: def.args, description: def.description })
  );
}

function buildServiceComposeTasks(params: DockerTaskParams & { readonly services: readonly string[] }): CommandItem[] {
  return params.services.map((service) =>
    buildComposeTask({
      ...params,
      name: `up ${service}`,
      args: `up ${service}`,
      description: `Start ${service} service`,
    })
  );
}

function buildComposeTask(params: DockerTaskParams & ComposeCommandDef): CommandItem {
  return {
    id: generateCommandId("docker", params.filePath, params.name),
    label: params.name,
    type: "docker",
    category: params.category,
    command: `docker compose -f ${quotePath(params.filePath)} ${params.args}`,
    cwd: params.dockerDir,
    filePath: params.filePath,
    tags: [],
    description: params.description,
  };
}

function buildDockerfileTask(file: vscode.Uri, workspaceRoot: string): CommandItem {
  const params = createDockerTaskParams(file, workspaceRoot);
  return {
    id: generateCommandId("docker", params.filePath, DOCKERFILE_BUILD_LABEL),
    label: DOCKERFILE_BUILD_LABEL,
    type: "docker",
    category: params.category,
    command: `docker build -f ${quotePath(params.filePath)} .`,
    cwd: params.dockerDir,
    filePath: params.filePath,
    tags: [],
    description: DOCKERFILE_BUILD_DESCRIPTION,
  };
}

function quotePath(filePath: string): string {
  return `${QUOTE_CHAR}${filePath.replaceAll(QUOTE_CHAR, `\\${QUOTE_CHAR}`)}${QUOTE_CHAR}`;
}

/** Counts leading spaces in a line. */
function leadingSpaces(line: string): number {
  let count = 0;
  while (count < line.length && line[count] === " ") {
    count++;
  }
  return count;
}

/** Returns true if the line should be skipped (empty or comment). */
function isSkippableLine(trimmed: string): boolean {
  return trimmed === "" || trimmed.startsWith("#");
}

/** Returns true if trimmed line is a top-level YAML key (ends with colon, no spaces). */
function isTopLevelKey(trimmed: string): boolean {
  return trimmed.endsWith(":") && !trimmed.includes(" ");
}

/** Checks if a character is valid for a service name start: [a-zA-Z_] */
function isValidNameStart(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

/** Checks if a character is valid within a service name: [a-zA-Z0-9_-] */
function isValidNameChar(ch: string): boolean {
  return isValidNameStart(ch) || (ch >= "0" && ch <= "9") || ch === "-";
}

/** Extracts a service name from a trimmed line like "myservice:" or returns empty string. */
function extractServiceName(trimmed: string): string {
  const firstChar = trimmed[0];
  if (trimmed.length === 0 || firstChar === undefined || !isValidNameStart(firstChar)) {
    return "";
  }
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx <= 0) {
    return "";
  }
  const candidate = trimmed.substring(0, colonIdx);
  const isValid = Array.from(candidate).every((ch) => isValidNameChar(ch));
  return isValid ? candidate : "";
}

/**
 * Parses docker-compose.yml to extract service names.
 * Uses simple YAML parsing without a full parser.
 */
function parseDockerComposeServices(content: string): string[] {
  const services: string[] = [];
  const lines = content.split("\n");
  let inServices = false;
  let servicesIndent = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (isSkippableLine(trimmed)) {
      continue;
    }
    const indent = leadingSpaces(line);
    ({ inServices, servicesIndent } = processLine({ trimmed, indent, inServices, servicesIndent, services }));
  }

  return services;
}

interface ParseState {
  readonly trimmed: string;
  readonly indent: number;
  readonly inServices: boolean;
  readonly servicesIndent: number;
  readonly services: string[];
}

/** Processes a single non-empty, non-comment line and returns updated parser state. */
function processLine(state: ParseState): { inServices: boolean; servicesIndent: number } {
  const { trimmed, indent, inServices, servicesIndent, services } = state;
  if (trimmed === "services:") {
    return { inServices: true, servicesIndent: indent };
  }
  if (inServices && indent <= servicesIndent && isTopLevelKey(trimmed)) {
    return { inServices: false, servicesIndent };
  }
  if (!inServices) {
    return { inServices, servicesIndent };
  }
  const isServiceDepth = indent === servicesIndent + 2 || (servicesIndent === 0 && indent === 2);
  if (isServiceDepth) {
    collectServiceName(trimmed, services);
  }
  return { inServices, servicesIndent };
}

/** Extracts a service name from the line and adds it to the list if valid and unique. */
function collectServiceName(trimmed: string, services: string[]): void {
  const name = extractServiceName(trimmed);
  if (name !== "" && !services.includes(name)) {
    services.push(name);
  }
}
