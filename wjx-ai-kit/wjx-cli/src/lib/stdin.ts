import { readFileSync } from "node:fs";
import type { Command } from "commander";
import { CliError } from "./errors.js";

/** Strip UTF-8 BOM (EF BB BF) if present — common on Windows-generated files. */
function stripBom(buf: Buffer): Buffer {
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    return buf.subarray(3);
  }
  return buf;
}

/**
 * Read JSON from a file path (UTF-8). Bypasses shell pipe encoding issues.
 */
export function readInputFile(filePath: string): Record<string, unknown> {
  let content: string;
  try {
    const buf = readFileSync(filePath);
    content = stripBom(buf).toString("utf8").trim();
  } catch (e) {
    throw new CliError("INPUT_ERROR", `无法读取输入文件 ${filePath}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!content) {
    return {};
  }
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new CliError("INPUT_ERROR",
        `输入文件 JSON 必须是对象，实际为 ${Array.isArray(parsed) ? "array" : typeof parsed}`);
    }
    return parsed as Record<string, unknown>;
  } catch (e) {
    if (e instanceof CliError) throw e;
    throw new CliError("INPUT_ERROR", `输入文件 JSON 解析失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

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
  const raw = stripBom(Buffer.concat(chunks)).toString("utf8").trim();

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
    if (key === "stdin" || key === "apiKey" || key === "json" || key === "table" || key === "dryRun") {
      continue;
    }
    const source = command.getOptionValueSource(key);
    // Only override stdin with explicitly provided CLI values, not defaults
    if (source === "cli") {
      merged[key] = opts[key];
    }
  }

  return merged;
}
