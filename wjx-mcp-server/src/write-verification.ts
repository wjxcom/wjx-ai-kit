import {
  WjxAmbiguousOutcomeError,
  type WjxApiResponse,
} from "wjx-api-sdk";
import { assertApiResponse, toolApiResult, toolError, toolResult } from "./helpers.js";

/** The state an Agent may safely infer after a side-effecting call. */
export type VerificationOutcome = "verified" | "pending" | "unknown";

/** Common evidence flags shared by survey and response write tools. */
export interface VerificationFlags {
  /** The target/identity or settings shape was present in the read-back. */
  structure: boolean;
  /** The requested lifecycle/settings state was confirmed. */
  status: boolean;
  /** A before/after count or equivalent durable identity was confirmed. */
  count: boolean;
  /** A link was relevant and validated, or the operation does not expose one. */
  link: boolean;
}

/** Machine-readable evidence attached to every verified write result. */
export interface VerificationReport {
  outcome: VerificationOutcome;
  verification: VerificationFlags;
  warnings: string[];
  /** Explicit next reads/actions required before an Agent may continue. */
  verificationRequired?: string[];
  [key: string]: unknown;
}

export interface VerificationContext<TWrite, TPreRead> {
  phase: "post-write" | "ambiguous";
  writeResult?: WjxApiResponse<TWrite>;
  preRead?: TPreRead;
}

export interface VerifiedWriteOptions<TWrite, TPreRead = unknown> {
  operation: string;
  /** A read-only snapshot. If it throws, the write is never attempted. */
  preRead?: () => Promise<TPreRead>;
  write: (preRead: TPreRead | undefined) => Promise<WjxApiResponse<TWrite>>;
  /** A read-only post-state check. It may return pending for eventual state. */
  verify: (context: VerificationContext<TWrite, TPreRead>) => Promise<VerificationReport>;
}

export const emptyVerification = (): VerificationFlags => ({
  structure: false,
  status: false,
  count: false,
  link: false,
});

/**
 * Parse a count supplied by the API without turning null-like values into 0.
 * Counts are integer quantities; reject ambiguous numeric spellings so a
 * destructive verification can only rely on explicit evidence.
 */
export function parseNonNegativeCount(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  }
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function unknownVerification(
  warning: string,
  verification: Partial<VerificationFlags> = {},
  verificationRequired: string[] = ["read-after-write"],
): VerificationReport {
  return {
    outcome: "unknown",
    verification: { ...emptyVerification(), ...verification },
    warnings: [warning],
    verificationRequired,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeReport(
  report: VerificationReport | undefined,
  fallbackWarning: string,
): VerificationReport {
  const normalized: VerificationReport = {
    ...(isRecord(report) ? report : {}),
    outcome: report?.outcome === "verified" || report?.outcome === "pending" || report?.outcome === "unknown"
      ? report.outcome
      : "unknown",
    verification: {
      ...emptyVerification(),
      ...(isRecord(report?.verification) ? report.verification : {}),
    },
    warnings: Array.isArray(report?.warnings)
      ? report.warnings.filter((item): item is string => typeof item === "string")
      : [fallbackWarning],
  };
  if (
    normalized.outcome === "verified"
    && (normalized.verification.structure !== true || normalized.verification.status !== true)
  ) {
    normalized.outcome = "unknown";
    normalized.warnings.push("读回验证缺少结构或状态证据，结果已降级为 unknown");
  }
  if (normalized.outcome !== "verified" && (!Array.isArray(normalized.verificationRequired) || normalized.verificationRequired.length === 0)) {
    normalized.verificationRequired = ["read-after-write"];
  }
  return normalized;
}

function attachReport(
  operation: string,
  writeResult: WjxApiResponse<unknown> | undefined,
  report: VerificationReport,
  verified: boolean,
  errorMessage?: string,
  transportDetails?: Record<string, unknown>,
) {
  const original: Record<string, unknown> = isRecord(writeResult) ? writeResult : {};
  const originalData = isRecord(original.data)
    ? original.data
    : original.data === undefined
      ? {}
      : { value: original.data };
  const payload = {
    ...original,
    result: verified,
    data: {
      ...originalData,
      ...report,
    },
    // Keep evidence at the envelope level as well as inside data. Existing
    // MCP callers read API fields from data, while Agent runtimes commonly
    // inspect outcome/verification without descending into data first.
    outcome: report.outcome,
    verification: report.verification,
    warnings: report.warnings,
    ...(report.verificationRequired ? { verificationRequired: report.verificationRequired } : {}),
    ...(transportDetails ?? {}),
  } as Record<string, unknown>;
  if (!verified) {
    payload.errormsg = errorMessage ?? `${operation} 写入结果无法通过读回验证`;
  }
  return toolResult(payload, !verified);
}

function ambiguousDetails(error: WjxAmbiguousOutcomeError): Record<string, unknown> {
  return {
    action: error.action,
    traceid: error.traceId,
    attempts: error.attempts,
  };
}

/**
 * Execute a non-idempotent MCP write with a mandatory typed read-back.
 *
 * The helper deliberately returns an MCP tool error when a successful write
 * cannot be proven. This prevents an Agent from treating `{ result: true }`
 * as durable state after an eventually-consistent or unavailable read.
 */
export async function runVerifiedWrite<TWrite, TPreRead = unknown>(
  options: VerifiedWriteOptions<TWrite, TPreRead>,
) {
  let preRead: TPreRead | undefined;
  if (options.preRead) {
    try {
      preRead = await options.preRead();
    } catch (error) {
      return toolError(error);
    }
  }

  let writeResult: WjxApiResponse<TWrite>;
  try {
    writeResult = await options.write(preRead);
  } catch (error) {
    if (!(error instanceof WjxAmbiguousOutcomeError)) return toolError(error);

    let report: VerificationReport;
    try {
      report = normalizeReport(
        await options.verify({ phase: "ambiguous", preRead }),
        "写入传输结果未知，读回未能确认最终状态",
      );
    } catch (verificationError) {
      report = unknownVerification(
        `写入传输结果未知，读回验证失败：${verificationError instanceof Error ? verificationError.message : String(verificationError)}`,
      );
    }
    const details = ambiguousDetails(error);
    if (report.outcome === "verified") {
      return attachReport(options.operation, undefined, report, true, undefined, details);
    }
    return attachReport(
      options.operation,
      undefined,
      report,
      false,
      `${error.message}；结果仍为 ${report.outcome === "pending" ? "pending" : "unknown"}，请先完成读回验证`,
      details,
    );
  }

  assertApiResponse(writeResult);
  if (writeResult.result === false) return toolApiResult(writeResult);

  let report: VerificationReport;
  try {
    report = normalizeReport(
      await options.verify({ phase: "post-write", writeResult, preRead }),
      `${options.operation} 写入后读回验证未完成`,
    );
  } catch (error) {
    report = unknownVerification(
      `${options.operation} 写入成功，但读回验证失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return attachReport(
    options.operation,
    writeResult as WjxApiResponse<unknown>,
    report,
    report.outcome === "verified",
  );
}
