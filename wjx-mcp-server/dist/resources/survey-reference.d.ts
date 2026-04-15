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
 * 问卷状态合法转换路径
 * 键: 当前状态编码，值: 可转换到的目标状态编码列表
 */
export declare const STATUS_TRANSITIONS: Record<number, {
    targets: number[];
    description: string;
}>;
