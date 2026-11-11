export interface SubmitTemplateQuestion {
    q_index: number;
    q_type: number;
    q_subtype?: number;
    q_title?: string;
    /** Non-matrix option list; matrix questions may use items for column headers. */
    items?: Array<{
        item_index: number;
        item_title?: string;
    }>;
    col_items?: Array<{
        item_index: number;
        item_title?: string;
    }>;
    /** Matrix row labels returned by getSurvey. */
    item_rows?: Array<{
        item_index: number;
        item_title?: string;
    }>;
    gap_count?: number;
}
export interface SubmitTemplateOutputQuestion {
    q_index: number;
    q_type: number;
    q_subtype?: number;
    q_title: string;
    placeholder: string;
    hint: string;
}
export interface SubmitTemplateResult {
    submitdata: string;
    questions: SubmitTemplateOutputQuestion[];
}
/**
 * Build a submitdata template from the raw question list returned by getSurvey.
 * Framework questions (q_type 1/2) are skipped and original q_index values are preserved.
 */
export declare function buildSubmitTemplate(questions: SubmitTemplateQuestion[]): SubmitTemplateResult;
