import type { SurveyDetail } from "./types.js";
/**
 * Map `${q_type}_${q_subtype}` to a human-readable DSL label.
 * Falls back to `[未知题型:q_type/q_subtype]` for unknown combinations.
 */
export declare function typeToLabel(q_type: number, q_subtype: number): string;
/**
 * Strip HTML tags from a string, replacing <br> variants with newline.
 */
export declare function stripHtml(text: string): string;
/**
 * Convert a SurveyDetail (from get_survey API) into a human-readable DSL text.
 *
 * The output is a "readable summary" of the survey, not a complete serialisation.
 * Branch logic, validation rules, scoring, randomisation etc. are not represented.
 */
export declare function surveyToText(survey: SurveyDetail): string;
