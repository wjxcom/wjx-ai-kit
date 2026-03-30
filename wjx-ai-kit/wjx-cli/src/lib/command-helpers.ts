import { Command } from "commander";
import type { WjxApiResponse } from "wjx-api-sdk";
import { getCredentials } from "./auth.js";
import { formatOutput } from "./output.js";
import { CliError, handleError } from "./errors.js";
import { mergeStdinWithOpts } from "./stdin.js";

/**
 * Strict integer parser. Rejects garbage like "123abc".
 */
export function strictInt(v: string): number {
  const n = Number(v);
  if (!Number.isInteger(n)) {
    throw new CliError("INPUT_ERROR", `Invalid integer: "${v}"`);
  }
  return n;
}

/**
 * Require a field in the merged input. Throws INPUT_ERROR if missing.
 */
export function requireField(merged: Record<string, unknown>, field: string, label?: string): void {
  if (merged[field] === undefined || merged[field] === null) {
    throw new CliError("INPUT_ERROR", `Missing required option: --${label || field}`);
  }
}

interface ExecuteOpts {
  noAuth?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SdkFunction = (input: any, creds: any, ...rest: any[]) => Promise<WjxApiResponse<any>>;

/**
 * Central command executor.
 * - Merges stdin data with CLI opts (source-aware)
 * - Gets credentials (unless noAuth)
 * - Calls SDK function
 * - Checks result===false (P0 fix)
 * - Formats output to stdout
 * - Routes errors to stderr JSON with correct exit codes
 */
export async function executeCommand(
  program: Command,
  actionCommand: Command,
  sdkFn: SdkFunction,
  buildInput: (merged: Record<string, unknown>) => Record<string, unknown>,
  opts: ExecuteOpts = {},
): Promise<void> {
  try {
    // Source-aware merge: stdin base + CLI-explicit overrides
    const stdinData = (actionCommand as unknown as Record<string, unknown>).__stdinData as Record<string, unknown> | undefined;
    const commandOpts = actionCommand.opts();
    let merged: Record<string, unknown>;

    if (stdinData && Object.keys(stdinData).length > 0) {
      merged = mergeStdinWithOpts(stdinData, actionCommand);
    } else {
      merged = { ...commandOpts };
    }

    const input = buildInput(merged);

    if (opts.noAuth) {
      // Local commands (e.g. buildSurveyUrl) — call with input only
      const localFn = sdkFn as unknown as (input: Record<string, unknown>) => unknown;
      const result = localFn(input);
      formatOutput(result, program.opts());
      return;
    }

    const creds = getCredentials(program.opts());
    const result = await sdkFn(input, creds);

    // P0 fix: detect SDK API failure response
    if (result.result === false) {
      throw new CliError(
        "API_ERROR",
        result.errormsg || "API request failed",
      );
    }

    formatOutput(result, program.opts());
  } catch (e) {
    handleError(e);
  }
}
