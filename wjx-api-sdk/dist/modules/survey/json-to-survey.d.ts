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
/**
 * 考试题型集合。JSONL 中的 qtype 属于此集合时：
 * - 服务端需要同时满足 `atype=6`（考试问卷）+ 题目含 `isquiz="1"`，
 *   才会按期望的考试子类型落库（如 判断题 305）。
 * - 否则服务端会降级为普通题型（如 考试判断 → 评分单选 303）。
 */
export declare const EXAM_QTYPES: Set<string>;
/**
 * 扫描 JSONL 文本，若发现考试题型：
 * - `hasExam=true`
 * - 为每道考试题自动注入 `isquiz="1"`（用户已显式设置则保留原值）
 *
 * 非考试题、_meta 行、空行、无法解析的行保持原样。
 */
export declare function preprocessExamJsonl(jsonl: string): {
    jsonl: string;
    hasExam: boolean;
};
/**
 * 扫描 JSONL 文本，为所有题目行注入 `requir: true`（用户未显式指定时）。
 * - 与页面创建行为保持一致：默认必答
 * - 非题目行（问卷基础信息、分页栏、段落说明、知情同意书）和空行/无法解析行保持原样
 */
export declare function injectDefaultRequir(jsonl: string): string;
/**
 * 从问卷标题中根据关键字推断问卷类型（atype）。
 * - 含"投票" → 3（投票）
 * - 含"考试" / "测试题" / "试卷" → 6（考试）
 * - 含"表单" / "报名表" / "登记表" / "申请表" → 7（表单）
 * - 含"测评" / "测试（心理/能力）" → 2（测评）
 * - 其他 → undefined（由调用方决定默认值）
 *
 * 用于 createSurveyByJson 在用户未显式指定 atype 时，根据问卷标题给出更合理的默认值。
 */
export declare function inferAtypeFromTitle(title: string): number | undefined;
/**
 * 校验问卷标题是否合法。不合法时抛出带可执行修复建议的错误。
 *
 * 拦截规则：
 * - 为空或全空白
 * - 仅由 `?`/`？`/空白组成（典型的 LLM 占位输出 "???"/"？？？"）
 * - 长度 < 2（单字标题通常是失败输出）
 * - 命中 {@link PLACEHOLDER_TITLES} 黑名单（大小写不敏感）
 *
 * 真实业务标题（如 "员工满意度调查"、"2026 年评选投票"）一律放行。
 */
export declare function validateSurveyTitle(rawTitle: string): void;
/**
 * 非题目类 qtype 只读集合（对外暴露，供调用方自行判断题目行）。
 * 语义与内部的 NON_QUESTION_QTYPES 一致。
 */
export declare const NON_QUESTION_QTYPE_SET: ReadonlySet<string>;
/**
 * 校验 JSONL 中至少包含 1 道真实题目。
 *
 * 排除项（不计入题目数）：
 * - 无法解析为 JSON 的行、空行
 * - qtype 缺失的行
 * - NON_QUESTION_QTYPES：问卷基础信息 / 分页栏 / 段落说明 / 知情同意书
 *
 * 零题目通常源于上层 LLM 生成失败（只吐出 _meta 行），应在客户端拦截，避免服务端创建空问卷。
 */
export declare function validateSurveyHasQuestions(jsonl: string): void;
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
