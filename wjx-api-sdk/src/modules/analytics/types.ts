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
  dataStatus: "ok" | "no-data";
  score: number | null;
  promoters: { count: number; ratio: number };
  passives: { count: number; ratio: number };
  detractors: { count: number; ratio: number };
  total: number;
  rating: string | null;
}

/** CSAT result */
export interface CsatResult {
  dataStatus: "ok" | "no-data";
  csat: number | null;
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
  warnings?: string[];
}

/** Metric comparison */
export interface MetricComparison {
  metric: string;
  valueA: number;
  valueB: number;
  delta: number;
  changeRate: number;
  significant: boolean;
  /** A threshold marker, not a statistical significance test. */
  significanceBasis: "heuristic-threshold";
}

export interface CompareResult {
  comparisons: MetricComparison[];
}

/** Push decode result */
export interface PushDecodeResult {
  decrypted: unknown;
  signatureValid?: boolean;
}
