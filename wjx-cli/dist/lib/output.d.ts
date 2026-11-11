export interface OutputOpts {
    format?: "json" | "pretty" | "table" | "ndjson" | "csv";
}
/** Validate the user-facing format before any command can perform I/O. */
export declare function validateOutputFormat(opts: Pick<OutputOpts, "format">): void;
/** Add respondent-facing URLs without ever exposing a numeric vid as the path. */
export declare function enrichSurveyListOutput(data: unknown): unknown;
export declare function formatOutput(data: unknown, opts: OutputOpts): void;
