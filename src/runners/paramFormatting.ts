import type { ParamDef } from "../models/TaskItem";

export interface ParamValue {
  readonly def: ParamDef;
  readonly value: string;
}

export function formatParam(def: ParamDef, value: string): string {
  const format = def.format ?? "positional";
  switch (format) {
    case "positional":
      return `"${value}"`;
    case "flag":
      return `${def.flag ?? `--${def.name}`} "${value}"`;
    case "flag-equals":
      return `${def.flag ?? `--${def.name}`}=${value}`;
    case "dashdash-args":
      return `-- ${value}`;
  }
}

export function buildCommand(baseCommand: string, params: readonly ParamValue[]): string {
  const parts: string[] = [];
  for (const { def, value } of params) {
    if (value === "") {
      continue;
    }
    const formatted = formatParam(def, value);
    if (formatted !== "") {
      parts.push(formatted);
    }
  }
  if (parts.length === 0) {
    return baseCommand;
  }
  return `${baseCommand} ${parts.join(" ")}`;
}
