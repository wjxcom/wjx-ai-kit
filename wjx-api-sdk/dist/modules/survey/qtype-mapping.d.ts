/**
 * The JSONL create API accepts human-readable qtype names while get_survey
 * returns the numeric q_type/q_subtype pair.  Keep the small, source-backed
 * intersection in one place so callers can verify a create without inventing
 * a second mapping table.
 */
export interface JsonlQuestionTypeExpectation {
    /** The qtype as it appeared in the JSONL document. */
    qtype: string;
    /** Numeric get_survey q_type when the mapping is reliable. */
    q_type?: number;
    /** Numeric get_survey q_subtype when the mapping is reliable. */
    q_subtype?: number;
}
export interface JsonlQuestionTypeCheck {
    matches: boolean;
    compared: number;
    unknownQtypes: string[];
    warnings: string[];
}
/** Return the documented numeric code for a JSONL qtype, if one is known. */
export declare function getJsonlQuestionTypeCode(qtype: string): JsonlQuestionTypeExpectation | undefined;
/**
 * Parse JSONL question rows into verification expectations. Unknown qtypes
 * are retained without numeric fields so callers can report the deliberate
 * skip instead of silently treating the row as verified.
 */
export declare function extractJsonlQuestionTypeExpectations(jsonl: string): JsonlQuestionTypeExpectation[];
/**
 * Compare JSONL expectations with get_survey question rows.  The API has
 * historically normalised a subtype to its family q_type (for example 301
 * to 3), so that representation is accepted when the family is correct.
 */
export declare function compareJsonlQuestionTypes(expected: readonly JsonlQuestionTypeExpectation[], actual: readonly Record<string, unknown>[], options?: {
    allowAdditionalRows?: boolean;
}): JsonlQuestionTypeCheck;
/** Remove page/paragraph rows so counts and positional checks use real items. */
export declare function filterJsonlVerificationQuestions(actual: readonly Record<string, unknown>[]): Record<string, unknown>[];
