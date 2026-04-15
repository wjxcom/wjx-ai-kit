import type { DecodeResponsesResult, NpsResult, CsatResult, AnomalyResult, CompareResult } from "./types.js";
export declare function decodeResponses(submitdata: string): DecodeResponsesResult;
export declare function calculateNps(scores: number[]): NpsResult;
export declare function calculateCsat(scores: number[], scaleType?: "5-point" | "7-point"): CsatResult;
interface ResponseRecord {
    id: string | number;
    answers?: (string | number)[];
    duration_seconds?: number;
    ip?: string;
    [key: string]: unknown;
}
export declare function detectAnomalies(responses: ResponseRecord[]): AnomalyResult;
export declare function compareMetrics(setA: Record<string, number>, setB: Record<string, number>): CompareResult;
export {};
