import type { ParamDef } from "../../models/TaskItem";

export interface MiseTask {
  name: string;
  description?: string;
  params: ParamDef[];
}

/**
 * Parses TOML format mise configuration.
 */
export function parseMiseToml(content: string): MiseTask[] {
  const tasks: MiseTask[] = [];

  const lines = content.split("\n");
  let currentTask: MiseTask | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // [tasks.name] sections are self-identifying — no [tasks] preamble needed
    if (trimmed.startsWith("[tasks.")) {
      if (currentTask !== null) {
        tasks.push(currentTask);
        currentTask = null;
      }

      const match = /^\[tasks\.([^\]]+)\]$/.exec(trimmed);
      if (match !== null && match[1] !== undefined) {
        currentTask = {
          name: match[1],
          params: [],
        };
      }
      continue;
    }

    // Any other section header ends the current task
    if (trimmed.startsWith("[")) {
      if (currentTask !== null) {
        tasks.push(currentTask);
        currentTask = null;
      }
      continue;
    }

    // Extract description from current task
    if (currentTask !== null && trimmed.startsWith("description")) {
      const descMatch = /^description\s*=\s*"([^"]*)"/.exec(trimmed);
      if (descMatch !== null && descMatch[1] !== undefined) {
        currentTask.description = descMatch[1];
      }
    }
  }

  if (currentTask !== null) {
    tasks.push(currentTask);
  }

  return tasks;
}

/**
 * Parses YAML format mise configuration.
 */
export function parseMiseYaml(content: string): MiseTask[] {
  const tasks: MiseTask[] = [];

  const lines = content.split("\n");
  let inTasks = false;

  for (const line of lines) {
    // Skip empty lines and comments
    if (line.trim() === "" || line.trim().startsWith("#")) {
      continue;
    }

    // Get indent level
    const indent = line.search(/\S/);

    // Check for "tasks:" at root level
    if (indent === 0 && line.trim() === "tasks:") {
      inTasks = true;
      continue;
    }

    // Exit tasks section if we hit another root-level key
    if (inTasks && indent === 0 && !line.trim().startsWith("tasks:")) {
      inTasks = false;
    }

    if (inTasks && indent > 0) {
      // Task name line (immediate child of tasks)
      if (indent === 2 && !line.trim().startsWith("-") && line.includes(":")) {
        const match = /^\s+([^:]+):\s*$/.exec(line);
        if (match !== null && match[1] !== undefined) {
          tasks.push({
            name: match[1].trim(),
            params: [],
          });
        }
      }

      // Description line (child of task)
      if (indent > 2 && line.includes("description:")) {
        const descMatch = /^\s+description:\s*["]?([^"]*)["]?\s*$/.exec(line);
        if (descMatch !== null && descMatch[1] !== undefined && tasks.length > 0) {
          const lastTask = tasks[tasks.length - 1];
          if (lastTask !== undefined) {
            lastTask.description = descMatch[1];
          }
        }
      }
    }
  }

  return tasks;
}
