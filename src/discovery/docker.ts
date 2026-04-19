import * as vscode from "vscode";
import * as path from "path";
import type { CommandItem, MutableCommandItem, IconDef, CategoryDef } from "../models/TaskItem";
import { generateCommandId, simplifyPath } from "../models/TaskItem";
import { readFileContent } from "../utils/fileUtils";

export const ICON_DEF: IconDef = {
  icon: "server-environment",
  color: "terminal.ansiBlue",
};
export const CATEGORY_DEF: CategoryDef = {
  type: "docker",
  label: "Docker Compose",
};

/**
 * Discovers Docker Compose services from docker-compose.yml files.
 */
export async function discoverDockerComposeServices(
  workspaceRoot: string,
  excludePatterns: string[]
): Promise<CommandItem[]> {
  const exclude = `{${excludePatterns.join(",")}}`;
  const [yml, yaml, composeYml, composeYaml] = await Promise.all([
    vscode.workspace.findFiles("**/docker-compose.yml", exclude),
    vscode.workspace.findFiles("**/docker-compose.yaml", exclude),
    vscode.workspace.findFiles("**/compose.yml", exclude),
    vscode.workspace.findFiles("**/compose.yaml", exclude),
  ]);
  const allFiles = [...yml, ...yaml, ...composeYml, ...composeYaml];
  const commands: CommandItem[] = [];

  for (const file of allFiles) {
    const content = await readFileContent(file);
    const dockerDir = path.dirname(file.fsPath);
    const category = simplifyPath(file.fsPath, workspaceRoot);
    const services = parseDockerComposeServices(content);

    // Add general compose commands
    const generalCommands = [
      {
        name: "up",
        command: "docker compose up",
        description: "Start all services",
      },
      {
        name: "up -d",
        command: "docker compose up -d",
        description: "Start in background",
      },
      {
        name: "down",
        command: "docker compose down",
        description: "Stop all services",
      },
      {
        name: "build",
        command: "docker compose build",
        description: "Build all services",
      },
      {
        name: "logs",
        command: "docker compose logs -f",
        description: "View logs",
      },
      {
        name: "ps",
        command: "docker compose ps",
        description: "List containers",
      },
    ];

    for (const cmd of generalCommands) {
      commands.push({
        id: generateCommandId("docker", file.fsPath, cmd.name),
        label: cmd.name,
        type: "docker",
        category,
        command: cmd.command,
        cwd: dockerDir,
        filePath: file.fsPath,
        tags: [],
        description: cmd.description,
      });
    }

    // Add per-service commands
    for (const service of services) {
      const task: MutableCommandItem = {
        id: generateCommandId("docker", file.fsPath, `up-${service}`),
        label: `up ${service}`,
        type: "docker",
        category,
        command: `docker compose up ${service}`,
        cwd: dockerDir,
        filePath: file.fsPath,
        tags: [],
        description: `Start ${service} service`,
      };
      commands.push(task);
    }
  }

  return commands;
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
