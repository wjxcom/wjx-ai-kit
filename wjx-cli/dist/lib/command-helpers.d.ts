import { Command } from "commander";
import type { FetchLike } from "wjx-api-sdk";
/**
 * Strict integer parser. Rejects garbage like "123abc".
 */
export declare function strictInt(v: string): number;
/**
 * Require a field in the merged input. Throws INPUT_ERROR if missing.
 */
export declare function requireField(merged: Record<string, unknown>, field: string, label?: string): void;
/** Require a positive integer for identifiers such as vid/system_id. */
export declare function requirePositiveInt(merged: Record<string, unknown>, field: string, label?: string): void;
/** Require an option to use one of the values documented by the API. */
export declare function requireEnum(merged: Record<string, unknown>, field: string, allowed: readonly (string | number)[], label?: string): void;
/** Require an integer in an inclusive range. */
export declare function requireIntRange(merged: Record<string, unknown>, field: string, min: number, max: number, label?: string): void;
export interface CapturedRequest {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
}
export declare function createCapturingFetch(): {
    fetchImpl: FetchLike;
    getCapturedRequest: () => CapturedRequest | null;
};
export declare function printDryRunPreview(request: CapturedRequest | null, opts?: {
    format?: "json" | "pretty" | "table" | "ndjson" | "csv";
}): void;
/** Merge stdin data with CLI opts (source-aware). */
export declare function getMerged(cmd: Command): Record<string, unknown>;
/**
 * Ensure a value is a JSON string suitable for the OpenAPI.
 * - If the value is a string, validate it's parseable JSON and return as-is.
 * - If the value is an array/object (e.g. from --stdin JSON parsing), JSON.stringify it.
 * - If undefined/null, return undefined.
 * This fixes the common issue where --stdin passes parsed objects while the API expects
 * a JSON-encoded string (double-encoded in the POST body).
 */
export declare function ensureJsonString(value: unknown, fieldName: string): string | undefined;
export declare function ensureStringArray(value: unknown, fieldName: string): string[] | undefined;
/** Validate a required JSON array and reject an empty collection. */
export declare function ensureNonEmptyJsonArray(value: unknown, fieldName: string): string | undefined;
/** Validate a JSON array while allowing an explicitly empty optional array. */
export declare function ensureJsonArray(value: unknown, fieldName: string): string | undefined;
/** Validate a JSON object (arrays and scalar JSON values are rejected). */
export declare function ensureJsonObject(value: unknown, fieldName: string): string | undefined;
