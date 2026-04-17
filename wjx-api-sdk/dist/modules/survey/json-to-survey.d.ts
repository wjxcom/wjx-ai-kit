/** JSONL 首行 "问卷基础信息" 解析结果 */
export interface JsonSurveyMetadata {
    title: string;
    description: string;
    endpageinformation: string;
    language: string;
}
/** createSurveyByJson 的 JSONL 大小上限（1 MB） */
export declare const MAX_JSONL_SIZE = 1000000;
/**
 * 从 JSONL 文本中提取首行 "问卷基础信息" 的元数据（title / description 等）。
 * 仅做最小解析：找到第一个 qtype === "问卷基础信息" 的行即返回。
 */
export declare function extractJsonlMetadata(jsonlText: string): JsonSurveyMetadata;
/**
 * 对 JSONL 文本做标准化预处理：
 * - 剥离 BOM（Windows UTF-8 BOM）
 * - CRLF → LF
 */
export declare function normalizeJsonl(jsonl: string): string;
