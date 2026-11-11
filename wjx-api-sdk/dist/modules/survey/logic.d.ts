import type { SurveyDslJson } from "./types.js";
/** Validate the shared, native-backed logic grammar before any transport. */
export declare function prepareSurveyDslJson(value: unknown): SurveyDslJson | undefined;
/** Request native page nodes only when the logic addresses page identifiers. */
export declare function surveyLogicReadOptions(logic?: string): {
    get_page_cut?: true;
};
/** Only reference consumers may replace the choices/rows copied by the service. */
export declare function surveyLogicPreservesQuestionContent(logic: string | undefined, before: readonly Record<string, unknown>[], after: readonly Record<string, unknown>[]): boolean;
/** Compare the requested native effects with the complete XML projection. */
export declare function surveyLogicMatches(expected: string, actual: unknown, questions?: readonly Record<string, unknown>[]): boolean;
