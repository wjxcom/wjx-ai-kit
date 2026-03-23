// ─── Input / Output types for analytics computation tools ────────────────────

/** Single decoded answer entry */
export interface DecodedAnswer {
  questionIndex: number;
  type: "single" | "multi" | "fill" | "matrix";
  value: string | string[] | Record<string, string>;
}

export interface DecodeResponsesResult {
  answers: DecodedAnswer[];
  count: number;
}

/** NPS categories */
export interface NpsResult {
  score: number;
  promoters: { count: number; ratio: number };
  passives: { count: number; ratio: number };
  detractors: { count: number; ratio: number };
  total: number;
  rating: string;
}

/** CSAT result */
export interface CsatResult {
  csat: number;
  satisfiedCount: number;
  total: number;
  distribution: Record<string, number>;
}

/** Anomaly detection */
export interface AnomalyFlag {
  responseId: string | number;
  reasons: string[];
}

export interface AnomalyResult {
  flagged: AnomalyFlag[];
  totalChecked: number;
}

/** Metric comparison */
export interface MetricComparison {
  metric: string;
  valueA: number;
  valueB: number;
  delta: number;
  changeRate: number;
  significant: boolean;
}

export interface CompareResult {
  comparisons: MetricComparison[];
}

/** Push decode result */
export interface PushDecodeResult {
  decrypted: unknown;
  signatureValid?: boolean;
}
