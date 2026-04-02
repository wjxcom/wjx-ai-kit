import { Command } from "commander";
import type { WjxApiResponse, FetchLike } from "wjx-api-sdk";
import { getCredentials } from "./auth.js";
import { formatOutput } from "./output.js";
import { CliError, handleError } from "./errors.js";
import { mergeStdinWithOpts } from "./stdin.js";

/**
 * Strict integer parser. Rejects garbage like "123abc".
 */
export function strictInt(v: string): number {
  if (v === "") {
    throw new CliError("INPUT_ERROR", `Invalid integer: ""`);
  }
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

export interface CapturedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

// "Bearer " prefix is 7 chars; preserve prefix + first 4 key chars, mask middle, keep last 4
function maskAuthHeader(value: string): string {
  if (value.length <= 12) return "****";
  return value.slice(0, 11) + "****" + value.slice(-4);
}

export function createCapturingFetch(): {
  fetchImpl: FetchLike;
  getCapturedRequest: () => CapturedRequest | null;
} {
  let captured: CapturedRequest | null = null;

  const fetchImpl: FetchLike = async (url, init) => {
    const headers: Record<string, string> = {};
    if (init?.headers) {
      for (const [k, v] of Object.entries(init.headers as Record<string, string>)) {
        headers[k] = k.toLowerCase() === "authorization" ? maskAuthHeader(String(v)) : String(v);
      }
    }
    captured = {
      method: init?.method ?? "GET",
      url: String(url),
      headers,
      body: init?.body ? String(init.body) : "",
    };
    return new Response(JSON.stringify({ result: true, data: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  return { fetchImpl, getCapturedRequest: () => captured };
}

export function printDryRunPreview(request: CapturedRequest | null): void {
  process.stderr.write(JSON.stringify({ dry_run: true, request }, null, 2) + "\n");
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
    const globalOpts = program.opts();

    if (opts.noAuth) {
      if (globalOpts.dryRun) {
        process.stderr.write(JSON.stringify({
          dry_run: true,
          note: "本地命令，不会发送 API 请求",
          input,
        }, null, 2) + "\n");
        return;
      }
      // Local commands (e.g. buildSurveyUrl) — call with input only
      const localFn = sdkFn as unknown as (input: Record<string, unknown>) => unknown;
      const result = localFn(input);
      formatOutput(result, globalOpts);
      return;
    }

    const creds = getCredentials(globalOpts);

    if (globalOpts.dryRun) {
      const { fetchImpl, getCapturedRequest } = createCapturingFetch();
      await sdkFn(input, creds, fetchImpl);
      printDryRunPreview(getCapturedRequest());
      return;
    }

    const result = await sdkFn(input, creds);

    // P0 fix: detect SDK API failure response
    if (result.result === false) {
      throw new CliError(
        "API_ERROR",
        result.errormsg || "API request failed",
      );
    }

    formatOutput(result, globalOpts);
  } catch (e) {
    handleError(e);
  }
}
