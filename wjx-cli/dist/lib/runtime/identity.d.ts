export type SurveyIdentityState = "match" | "mismatch" | "missing";
type SurveyRecord = Record<string, unknown>;
/**
 * Require an explicit, consistent survey identity for safety-sensitive reads.
 * Empty aliases are treated as omitted; any other malformed alias is a
 * mismatch so a valid sibling alias cannot mask corrupt response data.
 */
export declare function surveyIdentityState(data: SurveyRecord | undefined, vid: number): SurveyIdentityState;
export declare function surveyIdentityMatches(data: SurveyRecord | undefined, vid: number): boolean;
export {};
