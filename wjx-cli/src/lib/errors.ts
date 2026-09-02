import type { WjxApiResponse } from "wjx-api-sdk";
export type ErrorCode = "API_ERROR" | "INPUT_ERROR" | "AUTH_ERROR" | "CONFIRMATION_REQUIRED" | "POLICY_DENIED" | "UPGRADE_REQUIRED";

const EXIT_CODES: Record<ErrorCode, number> = {
  API_ERROR: 1,
  AUTH_ERROR: 1,
  INPUT_ERROR: 2,
  CONFIRMATION_REQUIRED: 3,
  POLICY_DENIED: 4,
  UPGRADE_REQUIRED: 1,
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

/** Internal control-flow marker: an error envelope has already been emitted. */
export class CliErrorHandled extends Error {
  constructor() {
    super("CLI error already handled");
    this.name = "CliErrorHandled";
  }
}

export function isCliErrorHandled(err: unknown): err is CliErrorHandled {
  return err instanceof CliErrorHandled;
}

/**
 * Write structured JSON error to stderr and terminate the current command path.
 */
export function stderrJson(code: ErrorCode, message: string, details?: ErrorDetails): never {
  const exitCode = EXIT_CODES[code];
  const type = code === "INPUT_ERROR" ? "validation" : code === "AUTH_ERROR" ? "authentication" : code === "CONFIRMATION_REQUIRED" ? "confirmation" : code === "POLICY_DENIED" ? "policy" : code === "UPGRADE_REQUIRED" ? "upgrade" : "api";
  const error = { type, subtype: code.toLowerCase(), code, message, retryable: false, ...(details ?? {}) };
  process.stderr.write(
    JSON.stringify({ ok: false, error, exitCode }) + "\n",
  );
  // Let in-flight fetch/socket cleanup finish before Node exits. Calling
  // process.exit() here can trigger a libuv assertion on Windows after a real
  // HTTP failure, replacing the intended CLI exit code with a crash code.
  process.exitCode = exitCode;
  throw new CliErrorHandled();
}

/**
 * Classify an unknown error into a CliError.
 * SDK JSONL validation errors are INPUT_ERROR.
 */
function classifyError(err: unknown): CliError {
  if (err instanceof CliError) return err;

  if (err instanceof SyntaxError) {
    return new CliError("INPUT_ERROR", err.message);
  }

  if (err instanceof Error) {
    const commanderCode = (err as Error & { code?: unknown }).code;
    if (typeof commanderCode === "string" && /^commander\.(?:unknownCommand|unknownOption|missingArgument|optionMissingArgument|missingMandatoryOptionValue|invalidArgument|excessArguments)$/i.test(commanderCode)) {
      return new CliError("INPUT_ERROR", err.message);
    }

    // SDK validation errors contain these patterns
    if (
      err.message.includes("must be valid JSON") ||
      err.message.includes("must be a JSON array") ||
      /^jsonl must (?:not be empty|be a string)/i.test(err.message) ||
      /^jsonl exceeds maximum size/i.test(err.message) ||
      /^title must be a string/i.test(err.message) ||
      err.message.includes("missing required field") ||
      // JSONL preflight / 标题 / 题目校验：本地输入错，不是服务端返回
      err.message.includes("JSONL 第") ||
      err.message.includes("问卷标题") ||
      err.message.includes("未找到有效题目") ||
      err.message.includes("optionalTitles") ||
      err.message.includes("当前接口不支持创建") ||
      err.message.includes("corpid is required") ||
      err.message.includes("DSL 包含不支持的题型") ||
      /^profile (?:name must not be blank|".*" not found)$/i.test(err.message) ||
      /Encrypted data|bad decrypt|wrong final block|unable to authenticate/i.test(err.message) ||
      err.message.startsWith("题目「")
    ) {
      return new CliError("INPUT_ERROR", err.message);
    }
    if (/unknown (?:command|option)/i.test(err.message)) {
      return new CliError("INPUT_ERROR", err.message);
    }
    return new CliError(
      "API_ERROR",
      err.message,
      isRetryableTransportError(err) ? { retryable: true } : undefined,
    );
  }

  return new CliError("API_ERROR", String(err));
}

/** Preserve transport retry guidance for agents after the SDK exhausts retries. */
function isRetryableTransportError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const code = err instanceof Error ? (err as Error & { code?: unknown }).code : undefined;
  const text = [message, typeof code === "string" ? code : ""].join(" ");
  return /\b(?:429|5\d{2})\b|timed out|fetch failed|network|connect|ECONN|ETIMEDOUT|EAI_AGAIN/i.test(text);
}

/**
 * Central error handler. Classifies the error and writes one stderr envelope.
 */
export function handleError(err: unknown): never {
  const cliErr = classifyError(err);
  stderrJson(cliErr.code, cliErr.message, cliErr.details);
}

/** Convert a WJX response failure without dropping upstream diagnostics. */
export function ensureApiSuccess<T>(response: WjxApiResponse<T>): asserts response is Extract<WjxApiResponse<T>, { result: true }> {
  const result = (response as unknown as { result?: unknown } | null | undefined)?.result;
  if (result === true) return;
  if (result !== false) {
    throw new CliError("API_ERROR", "API 响应格式无效：缺少 result 字段或取值不是布尔值");
  }

  const failure = response as Extract<WjxApiResponse<T>, { result: false }>;
  const details: ErrorDetails = {};
  if (failure.errorcode !== undefined) details.errorcode = failure.errorcode;
  if (failure.traceid !== undefined) details.traceid = failure.traceid;
  const upgrade = getUpgradeDetails(failure);
  if (upgrade) {
    const upgradeDetails: ErrorDetails = {
      ...details,
      upgrade_required: true,
      ...(upgrade.minClientVersion ? { min_client_version: upgrade.minClientVersion } : {}),
      ...(upgrade.command ? { upgrade_command: upgrade.command } : {}),
    };
    if (upgrade.minClientVersion || upgrade.command) {
      upgradeDetails.hint = [
        upgrade.minClientVersion ? `请升级 wjx-cli 至 ${upgrade.minClientVersion} 或更高版本` : "请升级 wjx-cli",
        upgrade.command ? `：${upgrade.command}` : "",
      ].join("");
    }
    throw new CliError(
      "UPGRADE_REQUIRED",
      failure.errormsg || "当前客户端版本需要升级",
      upgradeDetails,
    );
  }
  throw new CliError("API_ERROR", failure.errormsg || "API 请求失败", details);
}

interface UpgradeDetails {
  minClientVersion?: string;
  command?: string;
}

function getUpgradeDetails(failure: Extract<WjxApiResponse<unknown>, { result: false }>): UpgradeDetails | undefined {
  const data = failure.data && typeof failure.data === "object" && !Array.isArray(failure.data)
    ? failure.data as Record<string, unknown>
    : {};
  const errorCode = typeof failure.errorcode === "string" ? failure.errorcode.toUpperCase() : "";
  const dataCode = typeof data.code === "string" ? data.code.toUpperCase() : "";
  const isUpgradeCode = [errorCode, dataCode].some((code) => ["CLIENT_VERSION_TOO_OLD", "CLI_VERSION_TOO_OLD", "UPGRADE_REQUIRED"].includes(code));
  const isUpgradeData = data.upgrade_required === true;
  const hasUpgradeDetails = (
    typeof data.min_client_version === "string" && data.min_client_version.trim().length > 0
  ) || (
    typeof data.upgrade_command === "string" && data.upgrade_command.trim().length > 0
  );
  if (!isUpgradeCode && !isUpgradeData && !hasUpgradeDetails) return undefined;

  const minClientVersion = typeof data.min_client_version === "string" && data.min_client_version.trim()
    ? data.min_client_version.trim()
    : undefined;
  const command = typeof data.upgrade_command === "string" && data.upgrade_command.trim()
    ? data.upgrade_command.trim()
    : undefined;
  return { minClientVersion, command };
}
