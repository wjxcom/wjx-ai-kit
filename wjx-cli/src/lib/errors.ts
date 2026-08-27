export type ErrorCode = "API_ERROR" | "INPUT_ERROR" | "AUTH_ERROR" | "CONFIRMATION_REQUIRED" | "POLICY_DENIED";
import type { WjxApiResponse } from "wjx-api-sdk";

const EXIT_CODES: Record<ErrorCode, number> = {
  API_ERROR: 1,
  AUTH_ERROR: 1,
  INPUT_ERROR: 2,
  CONFIRMATION_REQUIRED: 3,
  POLICY_DENIED: 4,
};

export type ErrorDetails = Record<string, unknown>;

export class CliError extends Error {
  readonly code: ErrorCode;
  readonly exitCode: number;
  readonly details?: ErrorDetails;

  constructor(code: ErrorCode, message: string, details?: ErrorDetails) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.exitCode = EXIT_CODES[code];
    this.details = details;
  }
}

/**
 * Write structured JSON error to stderr and exit.
 */
export function stderrJson(code: ErrorCode, message: string, details?: ErrorDetails): never {
  const exitCode = EXIT_CODES[code];
  const type = code === "INPUT_ERROR" ? "validation" : code === "AUTH_ERROR" ? "authentication" : code === "CONFIRMATION_REQUIRED" ? "confirmation" : code === "POLICY_DENIED" ? "policy" : "api";
  const error = { type, subtype: code.toLowerCase(), code, message, retryable: false, ...(details ?? {}) };
  process.stderr.write(
    JSON.stringify({ ok: false, error, exitCode }) + "\n",
  );
  process.exit(exitCode);
}

/**
 * Classify an unknown error into a CliError.
 * SDK validation errors (e.g. validateQuestionsJson) are INPUT_ERROR.
 */
function classifyError(err: unknown): CliError {
  if (err instanceof CliError) return err;

  if (err instanceof SyntaxError) {
    return new CliError("INPUT_ERROR", err.message);
  }

  if (err instanceof Error) {
    // SDK validation errors contain these patterns
    if (
      err.message.includes("must be valid JSON") ||
      err.message.includes("must be a JSON array") ||
      err.message.includes("missing required field") ||
      // JSONL preflight / 标题 / 题目校验：本地输入错，不是服务端返回
      err.message.includes("JSONL 第") ||
      err.message.includes("问卷标题") ||
      err.message.includes("未找到有效题目") ||
      err.message.includes("optionalTitles") ||
      err.message.startsWith("题目「")
    ) {
      return new CliError("INPUT_ERROR", err.message);
    }
    return new CliError("API_ERROR", err.message);
  }

  return new CliError("API_ERROR", String(err));
}

/**
 * Central error handler. Classifies the error, writes stderr JSON, exits.
 */
export function handleError(err: unknown): never {
  const cliErr = classifyError(err);
  stderrJson(cliErr.code, cliErr.message, cliErr.details);
}

/** Convert a WJX response failure without dropping upstream diagnostics. */
export function ensureApiSuccess<T>(response: WjxApiResponse<T>): asserts response is Extract<WjxApiResponse<T>, { result: true }> {
  if (response.result !== false) return;
  const details: ErrorDetails = {};
  if (response.errorcode !== undefined) details.errorcode = response.errorcode;
  if (response.traceid !== undefined) details.traceid = response.traceid;
  throw new CliError("API_ERROR", response.errormsg || "API 请求失败", details);
}
