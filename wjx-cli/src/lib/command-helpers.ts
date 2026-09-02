import { Command } from "commander";
import type { FetchLike } from "wjx-api-sdk";
import { formatOutput } from "./output.js";
import { CliError } from "./errors.js";
import { mergeStdinWithOpts } from "./stdin.js";
import { maskAuthHeader } from "./mask.js";
import { redactJson } from "./mask.js";

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
  const value = merged[field];
  if (value === undefined || value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)) {
    throw new CliError("INPUT_ERROR", `Missing required option: --${label || field}`);
  }
}

/** Require a positive integer for identifiers such as vid/system_id. */
export function requirePositiveInt(merged: Record<string, unknown>, field: string, label?: string): void {
  requireField(merged, field, label);
  const value = merged[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new CliError("INPUT_ERROR", `--${label || field} 必须是正整数`);
  }
}

/** Require an option to use one of the values documented by the API. */
export function requireEnum(
  merged: Record<string, unknown>,
  field: string,
  allowed: readonly (string | number)[],
  label?: string,
): void {
  requireField(merged, field, label);
  const value = merged[field];
  if (!allowed.some((candidate) => candidate === value)) {
    throw new CliError(
      "INPUT_ERROR",
      `--${label || field} 必须是 ${allowed.join("、")} 之一`,
    );
  }
}

/** Require an integer in an inclusive range. */
export function requireIntRange(
  merged: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
  label?: string,
): void {
  requireField(merged, field, label);
  const value = merged[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new CliError("INPUT_ERROR", `--${label || field} 必须是 ${min}-${max} 范围内的整数`);
  }
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
        headers[k] = String(v);
      }
    }
    captured = {
      method: init?.method ?? "GET",
      url: String(url),
      headers,
      // Keep the transport snapshot lossless. Dry-run redaction belongs at
      // the output boundary so a captured request can never be reused as a
      // sanitized execution payload.
      body: init?.body ? String(init.body) : "",
    };
    return new Response(JSON.stringify({ result: true, data: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  return { fetchImpl, getCapturedRequest: () => captured };
}

/** Convert a captured transport request into a safe dry-run rendering. */
export function redactCapturedRequest(request: CapturedRequest): CapturedRequest {
  const headers = Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [
    key,
    key.toLowerCase() === "authorization" ? maskAuthHeader(value) : value,
  ]));
  return { ...request, headers, body: redactJson(request.body) };
}

export function printDryRunPreview(request: CapturedRequest | null, opts: { format?: "json" | "pretty" | "table" | "ndjson" | "csv" } = {}): void {
  const renderedRequest = request ? redactCapturedRequest(request) : null;
  formatOutput({
    kind: "dry-run",
    plans: renderedRequest ? [renderedRequest] : [],
  }, opts);
}

/** Merge stdin data with CLI opts (source-aware). */
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

/** Validate a required JSON array and reject an empty collection. */
export function ensureNonEmptyJsonArray(value: unknown, fieldName: string): string | undefined {
  const json = ensureJsonString(value, fieldName);
  if (json === undefined) return undefined;
  const parsed = JSON.parse(json) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new CliError("INPUT_ERROR", `${fieldName} 必须是非空 JSON 数组`);
  }
  return json;
}

/** Validate a JSON array while allowing an explicitly empty optional array. */
export function ensureJsonArray(value: unknown, fieldName: string): string | undefined {
  const json = ensureJsonString(value, fieldName);
  if (json === undefined) return undefined;
  if (!Array.isArray(JSON.parse(json))) {
    throw new CliError("INPUT_ERROR", `${fieldName} 必须是 JSON 数组`);
  }
  return json;
}

/** Validate a JSON object (arrays and scalar JSON values are rejected). */
export function ensureJsonObject(value: unknown, fieldName: string): string | undefined {
  const json = ensureJsonString(value, fieldName);
  if (json === undefined) return undefined;
  const parsed = JSON.parse(json) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CliError("INPUT_ERROR", `${fieldName} 必须是 JSON 对象`);
  }
  return json;
}
