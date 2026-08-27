import type { InputContext, NormalizedInput } from "./types.js";

export function mergeInputSources(
  stdin: Record<string, unknown> = {},
  cli: Record<string, unknown> = {},
  explicitCli: Iterable<string> = Object.keys(cli),
): Record<string, unknown> {
  const merged = { ...stdin, ...cli };
  const explicit = new Set(explicitCli);
  for (const key of Object.keys(cli)) {
    if (!explicit.has(key) && key in stdin) merged[key] = stdin[key];
  }
  return merged;
}

export function normalizeInput(context: InputContext): NormalizedInput {
  const values = { ...(context.defaults ?? {}), ...context.values };
  const source = { ...(context.source ?? {}) };
  for (const key of Object.keys(values)) source[key] ??= "input";
  return { values, source, unknown: [] };
}

