import type { ParsedSurvey, ParsedQuestion } from "./types.js";
/** Internal type → API wire format mapping. Exported for reference tooling. */
export declare const TYPE_MAP: Record<string, {
    q_type: number;
    q_subtype: number;
}>;
export interface WireQuestionItem {
    q_index: number;
    item_index: number;
    item_title: string;
    item_score?: number;
}
export interface WireQuestion {
    q_index: number;
    q_type: number;
    q_subtype: number;
    q_title: string;
    is_requir: boolean;
    items?: WireQuestionItem[];
    col_items?: WireQuestionItem[];
    total?: number;
    row_width?: number;
    /** 多项填空题填空数量（q_type=6 必填） */
    gap_count?: number;
    /** 矩阵展现形式（q_type=7 必填）：0=无, 101=量表, 102=多选, 103=单选, 201=填空 */
    matrix_mode?: number;
    /** 矩阵样式模式（q_type=7 必填）：0=常规 */
    style_mode?: number;
    /** 滑动条最小值（q_type=10 必填） */
    min_value?: number;
    /** 滑动条最大值（q_type=10 必填） */
    max_value?: number;
}
export interface WireConversionResult {
    questions: WireQuestion[];
    /** 被过滤掉的段落说明题目（API 不支持 q_type=2） */
    skippedParagraphs: ParsedQuestion[];
}
/**
 * Convert ParsedQuestion array to API wire format (question JSON for createSurvey).
 * 段落说明（q_type=2）会被过滤掉，因为 questions JSON 创建 API 不支持该题型。
 */
export declare function parsedQuestionsToWire(questions: ParsedQuestion[]): WireConversionResult;
/**
 * DSL type label → ParsedQuestion.type mapping.
 * Skeleton: 6 core types. Extend as needed.
 */
/** DSL type label → internal type mapping. Exported for reference tooling. */
export declare const LABEL_TO_TYPE: Record<string, string>;
/**
 * Parse DSL text (as produced by surveyToText) back into a ParsedSurvey structure.
 *
 * Skeleton parser: supports single-choice, multi-choice, fill-in, scale, matrix, paragraph.
 * Page breaks ("=== 分页 ===") are recognized but not represented in the output
 * (the flat question list is what the create API consumes).
 */
export declare function textToSurvey(text: string): ParsedSurvey;
