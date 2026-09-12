import { NON_QUESTION_QTYPE_SET } from "./json-to-survey.js";

/**
 * The JSONL create API accepts human-readable qtype names while get_survey
 * returns the numeric q_type/q_subtype pair.  Keep the small, source-backed
 * intersection in one place so callers can verify a create without inventing
 * a second mapping table.
 */

export interface JsonlQuestionTypeExpectation {
  /** The qtype as it appeared in the JSONL document. */
  qtype: string;
  /** Numeric get_survey q_type when the mapping is reliable. */
  q_type?: number;
  /** Numeric get_survey q_subtype when the mapping is reliable. */
  q_subtype?: number;
}

export interface JsonlQuestionTypeCheck {
  matches: boolean;
  compared: number;
  unknownQtypes: string[];
  warnings: string[];
}

type NumericQuestionType = { q_type: number; q_subtype?: number };

/*
 * These entries are limited to the codes documented by the SDK's
 * get_survey model (3.3/3.4) and the qtype names already used by JSONL
 * creation examples.  Specialized JSONL models intentionally stay unmapped:
 * guessing their storage family would make a successful create look wrong.
 */
const JSONL_QTYPE_CODES: Readonly<Record<string, NumericQuestionType>> = {
  "分页栏": { q_type: 1, q_subtype: 1 },
  "段落说明": { q_type: 2, q_subtype: 2 },
  "单选": { q_type: 3, q_subtype: 3 },
  "投票单选": { q_type: 3, q_subtype: 3 },
  "下拉框": { q_type: 3, q_subtype: 301 },
  "量表题": { q_type: 3, q_subtype: 302 },
  "NPS量表": { q_type: 3, q_subtype: 302 },
  "评分单选": { q_type: 3, q_subtype: 303 },
  "判断题": { q_type: 3, q_subtype: 305 },
  // The API stores an exam single-choice row as the scored-single subtype.
  "考试单选": { q_type: 3, q_subtype: 303 },
  "考试判断": { q_type: 3, q_subtype: 305 },
  "考试多选": { q_type: 4, q_subtype: 4 },
  "多选": { q_type: 4, q_subtype: 4 },
  "投票多选": { q_type: 4, q_subtype: 4 },
  "评分多选": { q_type: 4, q_subtype: 401 },
  "排序": { q_type: 4, q_subtype: 402 },
  "商品题": { q_type: 4, q_subtype: 403 },
  "单项填空": { q_type: 5, q_subtype: 5 },
  "简答题": { q_type: 5, q_subtype: 5 },
  "考试单项填空": { q_type: 5, q_subtype: 5 },
  "考试简答": { q_type: 5, q_subtype: 5 },
  "多级下拉": { q_type: 5, q_subtype: 501 },
  "多项填空": { q_type: 6, q_subtype: 6 },
  "考试多项填空": { q_type: 6, q_subtype: 601 },
  "矩阵填空": { q_type: 7, q_subtype: 704 },
  "矩阵单选": { q_type: 7, q_subtype: 702 },
  "矩阵多选": { q_type: 7, q_subtype: 703 },
  "矩阵量表": { q_type: 7, q_subtype: 701 },
  "矩阵滑动条": { q_type: 7, q_subtype: 705 },
  "矩阵数值题": { q_type: 7, q_subtype: 706 },
  "表格数值": { q_type: 7, q_subtype: 706 },
  "表格数值题": { q_type: 7, q_subtype: 706 },
  "表格填空": { q_type: 7, q_subtype: 707 },
  "表格填空题": { q_type: 7, q_subtype: 707 },
  "表格下拉框": { q_type: 7, q_subtype: 708 },
  "表格组合": { q_type: 7, q_subtype: 709 },
  "表格组合题": { q_type: 7, q_subtype: 709 },
  "自增表格": { q_type: 7, q_subtype: 710 },
  "表格自增题": { q_type: 7, q_subtype: 710 },
  "多项文件题": { q_type: 7, q_subtype: 711 },
  "多项简答题": { q_type: 7, q_subtype: 712 },
  "文件上传": { q_type: 8, q_subtype: 8 },
  "考试文件": { q_type: 8, q_subtype: 8 },
  "考试绘图": { q_type: 8, q_subtype: 801 },
  "比重题": { q_type: 9, q_subtype: 9 },
  "滑动条": { q_type: 10, q_subtype: 10 },
};

const JSONL_QTYPE_ALIASES: Readonly<Record<string, string>> = {
  "表格数值题": "表格数值",
  "表格填空题": "表格填空",
  "表格组合题": "表格组合",
  "表格自增题": "自增表格",
};

/*
 * The create endpoint accepts the JSONL names above, but the read endpoint
 * can expose a service-owned representation when the minimal JSONL shape is
 * normalized or expanded. Keep those alternatives explicit instead of
 * weakening every qtype check. The canonical code returned by
 * getJsonlQuestionTypeCode remains the documented OpenAPI mapping.
 */
const NORMALIZED_JSONL_QTYPE_CODES: Readonly<Record<string, readonly NumericQuestionType[]>> = {
  "下拉框": [
    { q_type: 301, q_subtype: 301 },
    { q_type: 3, q_subtype: 3 },
  ],
  "考试判断": [{ q_type: 3, q_subtype: 303 }],
  "考试多选": [{ q_type: 4, q_subtype: 401 }],
  "矩阵数值题": [
    { q_type: 3, q_subtype: 3 },
    { q_type: 5, q_subtype: 5 },
  ],
  "表格数值": [{ q_type: 7, q_subtype: 709 }],
  "表格填空": [{ q_type: 7, q_subtype: 709 }],
  "表格下拉框": [{ q_type: 7, q_subtype: 709 }],
  "自增表格": [{ q_type: 5, q_subtype: 5 }],
  "多项文件题": [{ q_type: 5, q_subtype: 5 }],
  "多项简答题": [{ q_type: 5, q_subtype: 5 }],
};

/** Return the documented numeric code for a JSONL qtype, if one is known. */
export function getJsonlQuestionTypeCode(qtype: string): JsonlQuestionTypeExpectation | undefined {
  if (typeof qtype !== "string" || !qtype.trim()) return undefined;
  const name = qtype.trim();
  if (name === "问卷基础信息") return undefined;
  const canonical = JSONL_QTYPE_ALIASES[name] ?? name;
  const code = JSONL_QTYPE_CODES[canonical];
  return code ? { qtype: name, ...code } : undefined;
}

/**
 * Parse JSONL question rows into verification expectations. Unknown qtypes
 * are retained without numeric fields so callers can report the deliberate
 * skip instead of silently treating the row as verified.
 */
export function extractJsonlQuestionTypeExpectations(jsonl: string): JsonlQuestionTypeExpectation[] {
  if (typeof jsonl !== "string") return [];
  const expectations: JsonlQuestionTypeExpectation[] = [];
  for (const line of jsonl.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let row: unknown;
    try { row = JSON.parse(trimmed); } catch { continue; }
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const qtype = (row as Record<string, unknown>).qtype;
    if (typeof qtype !== "string" || !qtype.trim() || NON_QUESTION_QTYPE_SET.has(qtype)) continue;
    const known = getJsonlQuestionTypeCode(qtype);
    expectations.push(known ?? { qtype: qtype.trim() });
  }
  return expectations;
}

function numeric(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value);
  return undefined;
}

function acceptedCodes(item: JsonlQuestionTypeExpectation): NumericQuestionType[] {
  if (item.q_type === undefined) return [];
  const canonical = JSONL_QTYPE_ALIASES[item.qtype] ?? item.qtype;
  return [
    { q_type: item.q_type, ...(item.q_subtype === undefined ? {} : { q_subtype: item.q_subtype }) },
    ...(NORMALIZED_JSONL_QTYPE_CODES[canonical] ?? []),
  ];
}

function codeMatches(item: JsonlQuestionTypeExpectation, row: Record<string, unknown> | undefined): boolean {
  const actualType = numeric(row?.q_type ?? row?.qType);
  const actualSubtype = numeric(row?.q_subtype ?? row?.qSubtype);
  return acceptedCodes(item).some((code) =>
    actualType === code.q_type
    && (code.q_subtype === undefined || actualSubtype === code.q_subtype),
  );
}

/**
 * Compare JSONL expectations with get_survey question rows.  The API has
 * historically normalised a subtype to its family q_type (for example 301
 * to 3), so that representation is accepted when the family is correct.
 */
export function compareJsonlQuestionTypes(
  expected: readonly JsonlQuestionTypeExpectation[],
  actual: readonly Record<string, unknown>[],
  options: { allowAdditionalRows?: boolean } = {},
): JsonlQuestionTypeCheck {
  let matches = true;
  let compared = 0;
  const unknown = new Set<string>();
  const warnings: string[] = [];

  // Page breaks and explanatory/consent rows are non-question JSONL entries;
  // get_survey may still expose page/paragraph records, so remove their
  // documented numeric families before positional comparison.
  const actualQuestions = filterJsonlVerificationQuestions(actual);
  const hasUnknownQtypes = expected.some((item) => item.q_type === undefined);
  const allowAdditionalRows = options.allowAdditionalRows === true || hasUnknownQtypes;
  const expectedKnownCount = expected.filter((item) => item.q_type !== undefined).length;
  if (
    allowAdditionalRows
      ? actualQuestions.length < expectedKnownCount
      : actualQuestions.length !== expected.length
  ) matches = false;

  let actualIndex = 0;
  for (let index = 0; index < expected.length; index++) {
    const item = expected[index];
    if (item.q_type === undefined) {
      unknown.add(item.qtype);
      continue;
    }
    compared++;
    const candidateIndex = allowAdditionalRows
      ? actualQuestions.findIndex((row, rowIndex) => rowIndex >= actualIndex && codeMatches(item, row))
      : index;
    const row = actualQuestions[candidateIndex];
    if (!codeMatches(item, row)) {
      matches = false;
      continue;
    }
    actualIndex = candidateIndex + 1;
    const actualSubtype = numeric(row?.q_subtype ?? row?.qSubtype);
    if (item.q_subtype !== undefined && actualSubtype === undefined) {
      matches = false;
      warnings.push(`第 ${index + 1} 道题缺少 q_subtype，无法确认 JSONL 题型「${item.qtype}」`);
    }
  }

  const unknownQtypes = [...unknown].sort((a, b) => a.localeCompare(b));
  if (unknownQtypes.length > 0) {
    warnings.push(`以下 JSONL 题型没有可靠的 q_type/q_subtype 映射，已跳过题型校验：${unknownQtypes.join("、")}`);
  }
  if (!matches) warnings.unshift("创建后的题目 q_type/q_subtype 与 JSONL 请求不一致");
  return { matches, compared, unknownQtypes, warnings };
}

/** Remove page/paragraph rows so counts and positional checks use real items. */
export function filterJsonlVerificationQuestions(
  actual: readonly Record<string, unknown>[],
): Record<string, unknown>[] {
  return actual.filter((row) => {
    const type = numeric(row?.q_type ?? row?.qType);
    return type !== 1 && type !== 2;
  });
}
