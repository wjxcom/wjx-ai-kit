import { Command } from "commander";
import type { WjxApiResponse, FetchLike } from "wjx-api-sdk";
import { getCredentials } from "./auth.js";
import { formatOutput } from "./output.js";
import { CliError, ensureApiSuccess, handleError } from "./errors.js";
import { mergeStdinWithOpts } from "./stdin.js";
import { maskAuthHeader } from "./mask.js";
import { getCommandMetadata, getCommandPath } from "./command-metadata.js";
import { ensureConfirmation } from "./runtime/confirmation.js";
import { createRuntimeContext, type RuntimeContext } from "./runtime/context.js";
import { resolveProfile } from "./profiles.js";

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
  /** Print only after a successful real execution; never pollutes errors or dry-run output. */
  deprecationWarning?: string;
  /** Add pure local information to a dry-run result without making network requests. */
  dryRunPreview?: (input: Record<string, unknown>) => Record<string, unknown> | undefined;
  /** 在输出前转换 API 返回结果（用于提取/重塑数据） */
  transformResult?: (result: WjxApiResponse<unknown>) => unknown;
  /** 在调用 SDK 之前异步转换 input（如获取问卷结构修正 submitdata） */
  transformInput?: (input: Record<string, unknown>, creds: unknown) => Promise<Record<string, unknown>>;
  /** Optional runtime dependencies for tests and embedded callers. */
  context?: RuntimeContext;
}

export interface CapturedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
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

export function printDryRunPreview(request: CapturedRequest | null, opts: { format?: "json" | "pretty" | "table" | "ndjson" | "csv"; table?: boolean } = {}): void {
  formatOutput({
    kind: "dry-run",
    plans: request ? [request] : [],
  }, opts);
}

/**
 * Merge stdin data with CLI opts (source-aware).
 * Extracts the common pattern used in both executeCommand and manual handlers.
 */
export function getMerged(cmd: Command): Record<string, unknown> {
  const stdinData = (cmd as unknown as Record<string, unknown>).__stdinData as Record<string, unknown> | undefined;
  if (stdinData && Object.keys(stdinData).length > 0) {
    return mergeStdinWithOpts(stdinData, cmd);
  }
  return { ...cmd.opts() };
}

/**
 * Ensure a value is a JSON string suitable for the OpenAPI.
 * - If the value is a string, validate it's parseable JSON and return as-is.
 * - If the value is an array/object (e.g. from --stdin JSON parsing), JSON.stringify it.
 * - If undefined/null, return undefined.
 * This fixes the common issue where --stdin passes parsed objects while the API expects
 * a JSON-encoded string (double-encoded in the POST body).
 */
export function ensureJsonString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    try {
      JSON.parse(value);
    } catch {
      throw new CliError("INPUT_ERROR", `${fieldName} 必须是合法的 JSON 字符串`);
    }
    return value;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  throw new CliError("INPUT_ERROR", `${fieldName} 必须是 JSON 字符串或对象`);
}

export function ensureStringArray(value: unknown, fieldName: string): string[] | undefined {
  const json = ensureJsonString(value, fieldName);
  if (json === undefined) return undefined;

  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new CliError("INPUT_ERROR", `${fieldName} 必须是字符串 JSON 数组`);
  }
  return parsed;
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
    const merged = getMerged(actionCommand);

    const input = buildInput(merged);
    const globalOpts = program.opts();

    if (opts.noAuth) {
      if (globalOpts.dryRun) {
        formatOutput({
          kind: "dry-run",
          plans: [],
          note: "本地命令，不会发送 API 请求",
          input,
        }, globalOpts);
        return;
      }
      // Local commands (e.g. buildSurveyUrl) — call with input only
      const localFn = sdkFn as unknown as (input: Record<string, unknown>) => unknown;
      const result = localFn(input);
      formatOutput(result, globalOpts);
      return;
    }

    const context = opts.context ?? createRuntimeContext({
      profile: { ...resolveProfile({ profile: globalOpts.profile }) },
    });

    await ensureConfirmation({
      command: getCommandPath(actionCommand),
      metadata: getCommandMetadata(getCommandPath(actionCommand)),
      input,
      options: {
        yes: globalOpts.yes === true,
        nonInteractive: globalOpts.nonInteractive === true,
        dryRun: globalOpts.dryRun === true,
      },
      policy: context.policy,
      inputStream: context.streams.stdin,
      outputStream: context.streams.stderr,
    });

    if (globalOpts.dryRun) {
      // Dry-run is deliberately limited to the already-normalized input.  An
      // async transform is an execution-time hook (and may perform a network
      // prefetch), so invoking it here would violate the zero-network contract.
      const { fetchImpl, getCapturedRequest } = createCapturingFetch();
      // SDK request construction only needs an API key to populate headers;
      // use a redacted placeholder so preview does not require credentials.
      const dryRunCreds = globalOpts.apiKey ? { apiKey: globalOpts.apiKey } : { apiKey: "dry-run" };
      await sdkFn(input, dryRunCreds, fetchImpl);
      const request = getCapturedRequest();
      const preview = opts.dryRunPreview?.(input);
      formatOutput({
        // Preview fields spread first so a command's dryRunPreview callback can
        // never shadow the envelope's protocol keys.
        ...(preview ?? {}),
        kind: "dry-run",
        plans: request ? [request] : [],
      }, globalOpts);
      return;
    }

    const creds = getCredentials(globalOpts);
    const finalInput = opts.transformInput ? await opts.transformInput(input, creds) : input;
    const result = await sdkFn(finalInput, creds);

    // P0 fix: detect SDK API failure response
    ensureApiSuccess(result);

    if (opts.deprecationWarning) {
      context.streams.stderr.write(`${opts.deprecationWarning}\n`);
    }

    const output = opts.transformResult ? opts.transformResult(result) : result;
    formatOutput(output, globalOpts);
  } catch (e) {
    handleError(e);
  }
}
