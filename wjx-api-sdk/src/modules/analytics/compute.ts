import type {
  DecodedAnswer,
  DecodeResponsesResult,
  NpsResult,
  CsatResult,
  AnomalyFlag,
  AnomalyResult,
  MetricComparison,
  CompareResult,
} from "./types.js";

// ─── decodeResponses ─────────────────────────────────────────────────────────
// Format: "题号$答案}题号$答案"
// Multi-choice answers use pipe separator: "1|2|3"
// Matrix answers use comma-separated sub-answers: "row1!col1,row2!col2"
// Legacy "_" separators are still accepted for backward compatibility.
// Fill-in answers are plain text
//
// NOTE: Without question metadata, type detection is heuristic-based.
// Pure numeric fill-in answers (e.g. "42") will be classified as "single"
// (single-choice) since we cannot distinguish them from option indices.

export function decodeResponses(submitdata: string): DecodeResponsesResult {
  if (!submitdata || submitdata.trim() === "") {
    return { answers: [], count: 0 };
  }

  const segments = submitdata.split("}");
  const answers: DecodedAnswer[] = [];

  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;

    const dollarIdx = trimmed.indexOf("$");
    if (dollarIdx === -1) continue;

    const qIdx = parseInt(trimmed.substring(0, dollarIdx), 10);
    if (Number.isNaN(qIdx)) continue;

    const rawValue = trimmed.substring(dollarIdx + 1);

    // Detect type based on content patterns
    const matrixValue = parseMatrixValue(rawValue);

    if (rawValue.includes("|")) {
      // Multi-choice: values separated by pipe
      answers.push({
        questionIndex: qIdx,
        type: "multi",
        value: rawValue.split("|"),
      });
    } else if (matrixValue) {
      answers.push({
        questionIndex: qIdx,
        type: "matrix",
        value: matrixValue,
      });
    } else if (/^\d+$/.test(rawValue)) {
      // Single choice: numeric answer
      answers.push({
        questionIndex: qIdx,
        type: "single",
        value: rawValue,
      });
    } else {
      // Fill-in: everything else
      answers.push({
        questionIndex: qIdx,
        type: "fill",
        value: rawValue,
      });
    }
  }

  return { answers, count: answers.length };
}

function parseMatrixValue(rawValue: string): Record<string, string> | null {
  const parts = rawValue
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  // 至少两段才视作 matrix，避免把 "hello_world" 这种 fill 文本误判。
  if (parts.length < 2) return null;

  const pairs: Record<string, string> = {};

  for (const part of parts) {
    const bangIdx = part.indexOf("!");
    const underIdx = bangIdx === -1 ? part.indexOf("_") : -1;
    const sepIdx = bangIdx !== -1 ? bangIdx : underIdx;

    if (sepIdx <= 0 || sepIdx >= part.length - 1) {
      return null;
    }

    pairs[part.substring(0, sepIdx)] = part.substring(sepIdx + 1);
  }

  return Object.keys(pairs).length > 0 ? pairs : null;
}

// ─── calculateNps ────────────────────────────────────────────────────────────
// NPS = %Promoters - %Detractors (scale 0-10)
// Promoters: 9-10, Passives: 7-8, Detractors: 0-6

export function calculateNps(scores: number[]): NpsResult {
  if (scores.length === 0) {
    return {
      score: 0,
      promoters: { count: 0, ratio: 0 },
      passives: { count: 0, ratio: 0 },
      detractors: { count: 0, ratio: 0 },
      total: 0,
      rating: "一般",
    };
  }

  const total = scores.length;
  let promoters = 0;
  let passives = 0;
  let detractors = 0;

  for (const s of scores) {
    if (s >= 9) promoters++;
    else if (s >= 7) passives++;
    else detractors++;
  }

  const score = Math.round(((promoters - detractors) / total) * 100);

  let rating: string;
  if (score > 70) rating = "优秀";
  else if (score >= 50) rating = "良好";
  else if (score >= 0) rating = "一般";
  else rating = "较差";

  return {
    score,
    promoters: { count: promoters, ratio: round4(promoters / total) },
    passives: { count: passives, ratio: round4(passives / total) },
    detractors: { count: detractors, ratio: round4(detractors / total) },
    total,
    rating,
  };
}

// ─── calculateCsat ───────────────────────────────────────────────────────────
// 5-point: satisfied = 4-5; 7-point: satisfied = 5-7

export function calculateCsat(
  scores: number[],
  scaleType: "5-point" | "7-point" = "5-point",
): CsatResult {
  if (scores.length === 0) {
    return { csat: 0, satisfiedCount: 0, total: 0, distribution: {} };
  }

  const total = scores.length;
  const distribution: Record<string, number> = {};
  let satisfiedCount = 0;

  const satisfiedMin = scaleType === "5-point" ? 4 : 5;

  for (const s of scores) {
    const key = String(s);
    distribution[key] = (distribution[key] || 0) + 1;
    if (s >= satisfiedMin) satisfiedCount++;
  }

  return {
    csat: round4(satisfiedCount / total),
    satisfiedCount,
    total,
    distribution,
  };
}

// ─── detectAnomalies ─────────────────────────────────────────────────────────

interface ResponseRecord {
  id?: string | number;
  jid?: string | number;
  answers?: unknown;
  submitdata?: string;
  duration_seconds?: number | string;
  inputcosttime?: number | string;
  ip?: string;
  [key: string]: unknown;
}

export function detectAnomalies(responses: ResponseRecord[]): AnomalyResult {
  const flagged: AnomalyFlag[] = [];

  // API responses use submitdata/inputcosttime, while callers may already have
  // decoded answers/duration_seconds. Normalize both representations first so
  // the three detectors operate on the same data.
  const normalized = responses.map((response, index) => ({
    response,
    responseId: response.id ?? response.jid ?? index + 1,
    answers: normalizeAnswers(response),
    durationSeconds: normalizeDuration(response),
  }));

  // Compute median duration for speed anomaly detection
  const durations = normalized
    .map((r) => r.durationSeconds)
    .filter((d): d is number => d !== undefined);
  const medianDuration = durations.length > 0 ? median(durations) : 0;
  const speedThreshold = medianDuration * 0.3; // < 30% of median is suspicious

  // Build IP+content map for duplicate detection
  const ipContentMap = new Map<string, (string | number)[]>();

  for (const { response: r, responseId, answers, durationSeconds } of normalized) {
    const reasons: string[] = [];

    // 1. Straight-lining: all answers identical
    if (answers && answers.length > 2) {
      const unique = new Set(answers);
      if (unique.size === 1) {
        reasons.push("straight-lining");
      }
    }

    // 2. Speed anomaly: completed too fast
    if (
      durationSeconds !== undefined &&
      medianDuration > 0 &&
      durationSeconds < speedThreshold
    ) {
      reasons.push("speed-anomaly");
    }

    // 3. IP + content duplicate
    if (r.ip && answers) {
      const contentKey = `${r.ip}:${answers.join(",")}`;
      const existing = ipContentMap.get(contentKey);
      if (existing) {
        existing.push(responseId);
        reasons.push("ip-content-duplicate");
      } else {
        ipContentMap.set(contentKey, [responseId]);
      }
    }

    if (reasons.length > 0) {
      flagged.push({ responseId, reasons });
    }
  }

  return { flagged, totalChecked: responses.length };
}

function normalizeAnswers(response: ResponseRecord): string[] | undefined {
  if (Array.isArray(response.answers)) {
    return response.answers.map(stringifyAnswer);
  }

  if (typeof response.submitdata === "string") {
    const decoded = decodeResponses(response.submitdata);
    if (decoded.answers.length === 0) return undefined;
    return decoded.answers.map((answer) => stringifyAnswer(answer.value));
  }

  return undefined;
}

function normalizeDuration(response: ResponseRecord): number | undefined {
  const raw = response.duration_seconds ?? response.inputcosttime;
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function stringifyAnswer(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || value === null) return String(value);
  return JSON.stringify(value) ?? String(value);
}

// ─── compareMetrics ──────────────────────────────────────────────────────────

export function compareMetrics(
  setA: Record<string, number>,
  setB: Record<string, number>,
): CompareResult {
  const allKeys = new Set([...Object.keys(setA), ...Object.keys(setB)]);
  const comparisons: MetricComparison[] = [];

  for (const metric of allKeys) {
    const valueA = setA[metric] ?? 0;
    const valueB = setB[metric] ?? 0;
    const delta = valueB - valueA;
    const changeRate = valueA === 0 ? (valueB === 0 ? 0 : 1) : round4(delta / Math.abs(valueA));
    const significant = Math.abs(changeRate) > 0.1;

    comparisons.push({ metric, valueA, valueB, delta, changeRate, significant });
  }

  return { comparisons };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
