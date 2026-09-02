import type { Command } from "commander";
import { CliError } from "./errors.js";

/**
 * Read JSON from stdin. Returns parsed object or empty object if no data.
 */
export async function readStdin(): Promise<Record<string, unknown>> {
  // If stdin is a TTY (no pipe), return empty
  if (process.stdin.isTTY) {
    return {};
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new CliError("INPUT_ERROR",
        `stdin JSON must be an object, got ${Array.isArray(parsed) ? "array" : typeof parsed}`);
    }
    return parsed as Record<string, unknown>;
  } catch (e) {
    if (e instanceof CliError) throw e;
    throw new CliError(
      "INPUT_ERROR",
      `stdin JSON parse error: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Source-aware merge: stdin as base, only CLI-explicit args override.
 * Uses Commander's getOptionValueSource() to distinguish user input from defaults.
 */
export function mergeStdinWithOpts(
  stdinData: Record<string, unknown>,
  command: Command,
): Record<string, unknown> {
  const opts = command.opts();
  const merged: Record<string, unknown> = { ...stdinData };

  for (const key of Object.keys(opts)) {
    // Skip internal flags
    if (key === "stdin" || key === "apiKey" || key === "dryRun") {
      continue;
    }
    const source = command.getOptionValueSource(key);
    // Only override stdin with explicitly provided CLI values, not defaults
    if (source === "cli") {
      merged[key] = opts[key];
    }
  }

  return normalizeOptionValues(merged, command);
}

/**
 * Apply the same Commander argument parsers to values supplied through JSON
 * stdin. CLI arguments already pass through `parseArg`, but stdin bypasses
 * Commander entirely unless we explicitly replay the parser here.
 */
function normalizeOptionValues(
  values: Record<string, unknown>,
  command: Command,
): Record<string, unknown> {
  const normalized = { ...values };
  for (const option of command.options) {
    const key = option.attributeName();
    if (!(key in normalized) || normalized[key] === undefined || normalized[key] === null) continue;

    const value = normalized[key];
    const flags = option.flags;
    const descriptorMatch = flags.match(/<([^>]+)>|\[([^\]]+)\]/);
    const descriptor = descriptorMatch?.[1] ?? descriptorMatch?.[2];

    if (option.parseArg) {
      if (typeof value !== "string" && typeof value !== "number") {
        throw new CliError(
          "INPUT_ERROR",
          `Invalid value for --${key}: expected a scalar string or number`,
        );
      }
      try {
        normalized[key] = option.parseArg(String(value), option.defaultValue);
      } catch (error) {
        if (error instanceof CliError) throw error;
        throw new CliError(
          "INPUT_ERROR",
          `Invalid value for --${key}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      continue;
    }

    // JSON options intentionally accept parsed arrays/objects from stdin;
    // all other value-bearing Commander options are scalar strings.
    if (descriptor === "json") continue;
    if (descriptor && typeof value !== "string") {
      throw new CliError("INPUT_ERROR", `Invalid value for --${key}: expected a string`);
    }
  }
  return normalized;
}
