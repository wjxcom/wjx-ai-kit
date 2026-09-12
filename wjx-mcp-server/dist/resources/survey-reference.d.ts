export declare const SURVEY_TYPES: Record<number, string>;
/**
 * WJX OpenAPI 题目类型 (q_type)
 * 编码来源: 官方 API 文档 3.3 题目类型
 *
 * 注意: 这些编码是 API 层面的编码，与问卷星前端 UI 显示的编号不同。
 * subtypes 对应 3.4 题目细分类型 (q_subtype)。
 */
export declare const QUESTION_TYPES: Record<number, {
    name: string;
    subtypes?: Record<number, string>;
}>;
export declare const SURVEY_STATUSES: Record<number, string>;
export declare const VERIFY_STATUSES: Record<number, string>;
/**
 * 文本题校验类型（OpenAPI 文档 3.5）。
 * 这些编码用于题目设置/读取结果，不是 JSONL qtype 名称。
 */
export declare const TEXT_VALIDATION_TYPES: Record<number, string>;
/** 矩阵题的展现形式（OpenAPI 文档 3.6）。 */
export declare const MATRIX_DISPLAY_TYPES: Record<number, string>;
/** 表格题的展现形式（OpenAPI 文档 3.7）。 */
export declare const TABLE_DISPLAY_TYPES: Record<number, string>;
/** 问卷设置内容类型（OpenAPI 文档 3.10）。 */
export declare const SURVEY_SETTING_TYPES: Record<number, string>;
/**
 * 问卷状态合法转换路径
 * 键: 当前状态编码，值: 可转换到的目标状态编码列表
 */
export declare const STATUS_TRANSITIONS: Record<number, {
    targets: number[];
    description: string;
}>;
