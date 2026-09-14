import type { WjxDslDiagnostic, WjxDslGenerationResult, WjxDslValidationOptions } from "./types.js";
export declare const MAX_WJX_DSL_BYTES: number;
/** Lightweight protocol checks. Semantic validation remains authoritative on the server. */
export declare function validateWjxDsl(value: unknown, options?: WjxDslValidationOptions): WjxDslDiagnostic[];
export declare function normalizeWjxDsl(value: string): string;
export declare function generateWjxDsl(value: string, options?: WjxDslValidationOptions): WjxDslGenerationResult;
