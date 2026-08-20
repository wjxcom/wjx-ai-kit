export interface OutputOpts {
    json?: boolean;
    table?: boolean;
}
/** Add respondent-facing URLs without ever exposing a numeric vid as the path. */
export declare function enrichSurveyListOutput(data: unknown): unknown;
export declare function formatOutput(data: unknown, opts: OutputOpts): void;
