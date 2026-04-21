import type { WireQuestion } from "./text-to-survey.js";
/** JSONL 首行 "问卷基础信息" 解析结果（轻量，只含元数据） */
export interface JsonSurveyMetadata {
    title: string;
    description: string;
    endpageinformation: string;
    language: string;
}
/** A raw JSON question object parsed from JSONL input. */
export interface JsonSurveyQuestion {
    qtype: string;
    title?: string;
    select?: string[];
    rowtitle?: string[];
    ins?: string;
    relation?: string;
    referselect?: string;
    requir?: boolean;
    randomchoice?: boolean | number;
    lowlimit?: number;
    uplimit?: number;
    minvalue?: string;
    maxvalue?: string;
    minvaluetext?: string;
    maxvaluetext?: string;
    total?: string;
    /** 问卷基础信息字段 */
    introduction?: string;
    endpageinformation?: string;
    language?: string;
    /** 知情同意书正文 */
    content?: string;
    /** 日期限制 */
    datelimitstart?: string;
    datelimitend?: string;
    /** 文件上传 */
    ext?: string;
    maxsize?: string;
    uploadlimit?: string;
    uploadcutimgsize?: string;
    /** 考试字段 */
    correctselect?: string[];
    quizscore?: string;
    answeranalysis?: string;
    isquiz?: string;
    include?: boolean;
    answerlists?: Array<{
        correctselect?: string[];
        quizscore?: string;
        include?: boolean;
    }>;
    isaigrading?: string;
    aiansweranalysis?: string;
    issignature?: string;
    verify?: string;
    codetype?: string;
    /** AI 题型字段 */
    interaction?: string;
    aihcikey1?: string;
    aihcikey2?: string;
    aihcikey3?: string;
    aigoal?: string;
    /** MaxDiff / BWS / 图片PK */
    mdattr?: string[];
    /** 联合分析 */
    columntitle?: string[];
    /** 品牌漏斗 */
    brands?: string[];
    /** 企业信息模糊查询 */
    fuzzyquery?: string;
    /** 多级下拉 */
    leveldata?: string;
    /** 分页栏 */
    mintime?: number;
    maxtime?: number;
    /** 答卷摄像 */
    cameratype?: string;
    /** PSM 模型 */
    steps?: string;
    /** 矩阵滑动条 — 用 minvalue/maxvalue + rowtitle */
    [key: string]: unknown;
}
/** Parsed survey structure from JSONL input. */
export interface JsonParsedSurvey {
    title: string;
    description: string;
    endpageinformation: string;
    language: string;
    questions: JsonSurveyQuestion[];
}
export interface JsonWireConversionResult {
    questions: WireQuestion[];
    /** 无法映射的题型（跳过但不报错） */
    skippedTypes: Array<{
        qtype: string;
        title: string;
    }>;
}
/** createSurveyByJson 的 JSONL 大小上限（1 MB） */
export declare const MAX_JSONL_SIZE = 1000000;
/**
 * 对 JSONL 文本做标准化预处理：
 * - 剥离 BOM（Windows UTF-8 BOM）
 * - CRLF → LF
 */
export declare function normalizeJsonl(jsonl: string): string;
/**
 * 从 JSONL 文本中提取首行 "问卷基础信息" 的元数据（title / description 等）。
 * 仅做最小解析：找到第一个 qtype === "问卷基础信息" 的行即返回。
 * 与 `jsonToSurvey` 不同的是：不解析所有题目、出错不抛异常、适合快速元数据读取。
 */
export declare function extractJsonlMetadata(jsonlText: string): JsonSurveyMetadata;
/** qtype 中文名 → API wire format { q_type, q_subtype } 映射表 */
export declare const QTYPE_MAP: Record<string, {
    q_type: number;
    q_subtype: number;
}>;
/**
 * Parse JSONL text (one JSON object per line) into an array of question objects.
 * 抛出带行号的错误信息以便定位。
 */
export declare function parseJsonl(jsonlText: string): JsonSurveyQuestion[];
/**
 * Parse JSONL text into a structured survey: extract metadata from "问卷基础信息" entry,
 * remaining entries become the questions array.
 */
export declare function jsonToSurvey(jsonlText: string): JsonParsedSurvey;
/**
 * Convert an array of JsonSurveyQuestion to API wire format (question JSON for createSurvey).
 * Unknown qtype entries are collected as `skippedTypes` rather than throwing —
 * 调用方若需要严格校验，可在拿到结果后自行检查 `skippedTypes.length === 0`。
 */
export declare function jsonQuestionsToWire(questions: JsonSurveyQuestion[]): JsonWireConversionResult;
