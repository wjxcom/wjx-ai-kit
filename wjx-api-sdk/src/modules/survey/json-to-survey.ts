// ─── Types ──────────────────────────────────────────────────────────

/** JSONL 首行 "问卷基础信息" 解析结果（轻量，只含元数据） */
export interface JsonSurveyMetadata {
  title: string;
  description: string;
  endpageinformation: string;
  language: string;
  /** 用户在 JSONL 内部声明的 atype（1=调查 / 2=测评 / 3=投票 / 6=考试 / 7=表单）。未声明时为 undefined。 */
  atype?: number;
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
  correctselect?: string | string[];
  quizscore?: string;
  answeranalysis?: string;
  isquiz?: string;
  include?: boolean;
  answerlists?: Array<{
    correctselect?: string | string[];
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
  /** 表格题字段类型（与 rowtitle 一一对应） */
  columntype?: string[];
  /** 表格题字段补充数据（与 rowtitle / columntype 一一对应） */
  columndata?: string[];
  /**
   * 表格题列输入类型（表格组合专用，与 rowtitle 等长）。
   * 支持值：单选 / 多选 / 下拉 / 数字 / 小数 / 日期 / 手机 / Email / 文本。
   */
  types?: string[];
  /**
   * 表格题选项数据：
   * - 表格下拉框 / 表格组合：长度 = rowtitle，selects[i] 是第 i 列的选项数组（如 ["新手","初级","中级"]）；
   *   表格组合中文本/数字等无选项类型可传 [] 占位。
   * - 自增表格：单层数组 [rowTmpl]；rowTmpl[i] 是第 i 列的输入模板：
   *     ""（空字符串）→ 文本；"a|b|c"（| 分隔）→ 下拉，选项 a/b/c。
   */
  selects?: string[][];
  /** 品牌漏斗 */
  brands?: string[];
  /** 企业信息模糊查询 */
  fuzzyquery?: string;
  /** 多级下拉 */
  leveldata?: string | string[];
  /** 分页栏 */
  mintime?: number;
  maxtime?: number;
  /** 自增表格 */
  min_rows?: number;
  max_rows?: number;
  /** 答卷摄像 */
  cameratype?: string;
  /** PSM 模型 */
  steps?: string;
  /** 矩阵滑动条 — 用 minvalue/maxvalue + rowtitle */
  stores?: string[];
  heatbg?: string;
  hidetxt?: string | boolean;
  answer?: string;
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

/** createSurveyByJson 的 JSONL 大小上限（1 MB） */
export const MAX_JSONL_SIZE = 1_000_000;

// ─── 标准化预处理 ──────────────────────────────────────────────────

/**
 * 对 JSONL 文本做标准化预处理：
 * - 剥离 BOM（Windows UTF-8 BOM）
 * - CRLF → LF
 */
export function normalizeJsonl(jsonl: string): string {
  return jsonl.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}

// ─── JSONL 元数据提取（轻量快速路径） ──────────────────────────────

/**
 * 从 JSONL 文本中提取首行 "问卷基础信息" 的元数据（title / description 等）。
 * 仅做最小解析：找到第一个 qtype === "问卷基础信息" 的行即返回。
 * 与 `jsonToSurvey` 不同的是：不解析所有题目、出错不抛异常、适合快速元数据读取。
 */
export function extractJsonlMetadata(jsonlText: string): JsonSurveyMetadata {
  const lines = jsonlText.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      if (obj.qtype === "问卷基础信息") {
        const rawAtype = obj.atype;
        const atype =
          typeof rawAtype === "number" && Number.isFinite(rawAtype)
            ? rawAtype
            : typeof rawAtype === "string" && /^\d+$/.test(rawAtype)
              ? Number(rawAtype)
              : undefined;
        return {
          title: typeof obj.title === "string" ? obj.title : "",
          description: typeof obj.introduction === "string" ? obj.introduction : "",
          endpageinformation: typeof obj.endpageinformation === "string" ? obj.endpageinformation : "",
          language: typeof obj.language === "string" ? obj.language : "zh",
          atype,
        };
      }
    } catch {
      // 跳过无法解析的行，让服务端处理
    }
  }
  return { title: "", description: "", endpageinformation: "", language: "zh" };
}

// ─── 考试题型预处理 ─────────────────────────────────────────────────

/**
 * 考试题型集合。JSONL 中的 qtype 属于此集合时：
 * - 服务端需要同时满足 `atype=6`（考试问卷）+ 题目含 `isquiz="1"`，
 *   才会按期望的考试子类型落库（如 判断题 305）。
 * - 否则服务端会降级为普通题型（如 考试判断 → 评分单选 303）。
 */
export const EXAM_QTYPES = new Set<string>([
  "考试单选",
  "考试判断",
  "考试多选",
  "考试单项填空",
  "考试多项填空",
  "考试简答",
  "考试文件",
  "考试绘图",
  "考试代码",
]);

/**
 * 扫描 JSONL 文本，若发现考试题型：
 * - `hasExam=true`
 * - 为每道考试题自动注入 `isquiz="1"`（显式设置为其他值会被拒绝，避免考试题降级）
 *
 * 非考试题、_meta 行、空行、无法解析的行保持原样。
 */
export function preprocessExamJsonl(jsonl: string): { jsonl: string; hasExam: boolean } {
  const lines = jsonl.split("\n");
  let hasExam = false;
  const processed = lines.map((line, lineIndex) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return line;
    }
    if (typeof obj.qtype === "string" && EXAM_QTYPES.has(obj.qtype)) {
      hasExam = true;
      if (obj.isquiz === undefined) {
        obj.isquiz = "1";
        return JSON.stringify(obj);
      }
      if (obj.isquiz !== "1") {
        throw new Error(
          `JSONL 第 ${lineIndex + 1} 行考试题 ${obj.qtype} 的 isquiz 必须为 "1"，不能使用 ${JSON.stringify(obj.isquiz)}，否则服务端会按普通题型降级。`,
        );
      }
    }
    return line;
  });
  return { jsonl: processed.join("\n"), hasExam };
}

export function hasVoteJsonlQtype(jsonl: string): boolean {
  for (const line of jsonl.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      if (obj.qtype === "投票单选" || obj.qtype === "投票多选") {
        return true;
      }
    } catch {
      // 保持轻量扫描：无效行交给后续服务端/校验流程处理。
    }
  }
  return false;
}

// ─── 默认必答预处理 ─────────────────────────────────────────────────

/**
 * 非题目类 qtype（这些不需要注入 requir 字段）。
 */
const NON_QUESTION_QTYPES = new Set<string>([
  "问卷基础信息",
  "分页栏",
  "段落说明",
  "知情同意书",
]);

function buildOptionalTitleSet(optionalTitles: string[] = []): Set<string> {
  return new Set(
    optionalTitles
      .map((title) => title.trim())
      .filter((title) => title.length > 0),
  );
}

/**
 * 扫描 JSONL 文本，为所有题目行注入 `requir: true`（用户未显式指定时）。
 * - 与页面创建行为保持一致：默认必答
 * - 非题目行（问卷基础信息、分页栏、段落说明、知情同意书）和空行/无法解析行保持原样
 */
export function injectDefaultRequir(jsonl: string): string {
  const lines = jsonl.split("\n");
  const processed = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return line;
    }
    if (typeof obj.qtype !== "string" || NON_QUESTION_QTYPES.has(obj.qtype)) {
      return line;
    }
    if (obj.requir === undefined) {
      obj.requir = true;
      return JSON.stringify(obj);
    }
    return line;
  });
  return processed.join("\n");
}

/**
 * 校验 JSONL 中显式写出的 `requir:false` 是否真的被调用方明确允许。
 * 默认所有题目必答；只有标题列入 optionalTitles 的题目，才允许非必答。
 */
export function validateExplicitOptionalQuestionsInJsonl(
  jsonl: string,
  optionalTitles: string[] = [],
): void {
  const allowedTitles = buildOptionalTitleSet(optionalTitles);
  const lines = jsonl.split("\n");

  for (const [lineIndex, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Keep malformed JSON handling in parseJsonl so it retains the
      // existing line-numbered syntax diagnostic.
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(
        `JSONL 第 ${lineIndex + 1} 行必须是 JSON 对象，不能是 ${parsed === null ? "null" : Array.isArray(parsed) ? "数组" : typeof parsed}`,
      );
    }
    const obj = parsed as Record<string, unknown>;

    if (typeof obj.qtype !== "string" || NON_QUESTION_QTYPES.has(obj.qtype)) {
      continue;
    }
    if (obj.requir !== false) {
      continue;
    }

    const title = typeof obj.title === "string" ? obj.title.trim() : "";
    if (!title) {
      throw new Error(
        `第 ${lineIndex + 1} 行题目显式设置了 requir=false，但缺少可匹配的 title。默认所有题目必答；如需设为选填，请提供明确标题并把它加入 optionalTitles。`,
      );
    }
    if (!allowedTitles.has(title)) {
      throw new Error(
        `题目「${title}」显式设置了 requir=false，但未在 optionalTitles 中声明。默认所有题目必答；如需设为选填，请把该标题加入 optionalTitles。`,
      );
    }
  }
}

// ─── atype 注入到 JSONL 首行 ───────────────────────────────────────

/**
 * 将 `atype` 写入 JSONL 首行的「问卷基础信息」对象（覆盖已有值）。
 * - 存在「问卷基础信息」行：就地注入/覆盖 atype 字段
 * - 不存在「问卷基础信息」行：在 JSONL 头部插入一行 `{"qtype":"问卷基础信息","atype":<n>}`
 *
 * 背景：问卷星 action 1000106（create_survey_by_json）服务端实际只从 JSONL 内的
 * 「问卷基础信息」行读取 atype，忽略顶层 POST 参数的 atype。顶层字段仍需保留作为
 * 冗余双保险，但必须同时把 atype 注入 JSONL，否则无论顶层传什么都落库为 atype=1。
 */
export function injectAtypeIntoJsonl(jsonl: string, atype: number): string {
  const lines = jsonl.split("\n");
  let injected = false;
  const out = lines.map((line) => {
    if (injected) return line;
    const trimmed = line.trim();
    if (!trimmed) return line;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return line;
    }
    if (obj.qtype === "问卷基础信息") {
      obj.atype = atype;
      injected = true;
      return JSON.stringify(obj);
    }
    return line;
  });
  if (!injected) {
    return `${JSON.stringify({ qtype: "问卷基础信息", atype })}\n${jsonl}`;
  }
  return out.join("\n");
}

// ─── 从标题/元数据推断问卷类型（atype） ────────────────────────────

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
export function inferAtypeFromTitle(title: string): number | undefined {
  if (!title) return undefined;
  if (title.includes("投票")) return 3;
  if (title.includes("考试") || title.includes("试卷") || title.includes("测试题")) return 6;
  if (/表单|报名表|登记表|申请表/.test(title)) return 7;
  if (title.includes("测评")) return 2;
  return undefined;
}

// ─── 标题 & 题目数合理性校验 ────────────────────────────────────────

/**
 * 已知占位符标题黑名单（命中则拦截）。
 * 只收录明显无语义、绝对不该落库的值；真实问卷主题（如 "客户满意度调查"）不会命中。
 */
const PLACEHOLDER_TITLES = new Set<string>([
  "无标题", "未命名", "新问卷", "待定", "待填", "待补充", "暂无",
  "untitled", "placeholder", "todo", "tbd", "na", "n/a",
  "xxx", "xx", "xyz", "aaa", "test", "demo", "sample", "example",
  "title", "问卷标题", "标题",
]);

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
export function validateSurveyTitle(rawTitle: string): void {
  const title = (rawTitle ?? "").trim();
  const actionHint =
    '请在 JSONL 首行 {"qtype":"问卷基础信息","title":"..."} 中填写真实问卷主题' +
    '（例："2026 年员工满意度调查"、"新产品上市用户测试"），' +
    "或在调用 create_survey_by_json 时传入 title 参数显式覆盖。";

  if (!title) {
    throw new Error(`问卷标题缺失：未在 JSONL 中找到有效的标题。${actionHint}`);
  }
  if (/^[?？\s]+$/.test(title)) {
    throw new Error(
      `问卷标题无效（"${rawTitle}"）：疑似 LLM 占位输出或编码错误。${actionHint}`,
    );
  }
  if (title.length < 2) {
    throw new Error(
      `问卷标题过短（"${rawTitle}"）：至少需要 2 个字符。${actionHint}`,
    );
  }
  if (PLACEHOLDER_TITLES.has(title.toLowerCase())) {
    throw new Error(
      `问卷标题为占位符（"${rawTitle}"）：禁止使用 无标题/未命名/untitled/placeholder/TODO/xxx 等无语义值。${actionHint}`,
    );
  }
}

/**
 * 非题目类 qtype 只读集合（对外暴露，供调用方自行判断题目行）。
 * 语义与内部的 NON_QUESTION_QTYPES 一致。
 */
export const NON_QUESTION_QTYPE_SET: ReadonlySet<string> = NON_QUESTION_QTYPES;

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
export function validateSurveyHasQuestions(jsonl: string): void {
  let questionCount = 0;
  for (const [lineIndex, line] of jsonl.split("\n").entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(
        `JSONL 第 ${lineIndex + 1} 行必须是 JSON 对象，不能是 ${parsed === null ? "null" : Array.isArray(parsed) ? "数组" : typeof parsed}`,
      );
    }
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.qtype !== "string") continue;
    if (NON_QUESTION_QTYPES.has(obj.qtype)) continue;
    questionCount++;
  }
  if (questionCount < 1) {
    throw new Error(
      "问卷中未找到有效题目：JSONL 仅包含元数据/分页栏/段落说明/知情同意书，没有真正的题目。" +
        "请在 JSONL 中添加至少 1 道题目（如 {\"qtype\":\"单选\",\"title\":\"...\",\"select\":[...]}）。" +
        "如果你是 AI Agent，请重新按主题生成完整题目列表，不要只输出 _meta 行。",
    );
  }
}

// ─── JSONL qtype allowlist ───────────────────────────────────────────
/**
 * Canonical qtype names documented for action 1000106.
 * The service owns the JSONL-to-survey conversion; the SDK only validates
 * names and preserves their JSON fields for transport.
 */
const DOCUMENTED_JSONL_QTYPES = [
  "问卷基础信息",
  "单选",
  "多选",
  "下拉框",
  "文件上传",
  "排序",
  "单项填空",
  "简答题",
  "多项填空",
  "签名题",
  "地图",
  "日期",
  "分页栏",
  "段落说明",
  "折叠栏目",
  "轮播图",
  "量表题",
  "NPS量表",
  "评分单选",
  "评分多选",
  "评价题",
  "比重题",
  "滑动条",
  "矩阵填空",
  "矩阵单选",
  "矩阵多选",
  "矩阵量表",
  "矩阵滑动条",
  "表格数值",
  "表格组合",
  "表格填空",
  "表格下拉框",
  "自增表格",
  "多级下拉",
  "门店选择",
  "AI追问",
  "AI处理",
  "AI访谈",
  "图片OCR",
  "情景随机",
  "商品题",
  "预约题",
  "VlookUp问卷关联",
  "循环评价",
  "热力图",
  "BWS",
  "MaxDiff",
  "图片PK",
  "联合分析",
  "Kano模型",
  "SUS模型",
  "品牌漏斗",
  "货架题",
  "BPTO模型",
  "PSM模型",
  "价格断裂点",
  "层次分析",
  "选项分类",
  "CATI调研",
  "文字点睛",
  "心理学实验",
  "姓名",
  "基本信息",
  "身份证号",
  "性别",
  "年龄段",
  "民族",
  "学历",
  "婚姻",
  "国家及地区",
  "省市",
  "省市区",
  "邮箱",
  "手机",
  "手机验证",
  "时间",
  "职业",
  "行业",
  "高校",
  "邮寄地址",
  "社会阶层",
  "设备信息",
  "城市级别",
  "企业信息",
  "当前语言",
  "答题录音",
  "答卷摄像",
  "分页计时器",
  "知情同意书",
  "密码",
  "考试单选",
  "考试判断",
  "考试多选",
  "考试单项填空",
  "考试多项填空",
  "考试简答",
  "考试文件",
  "考试绘图",
  "考试代码",
] as const;

const ADDITIONAL_JSONL_QTYPES = [
  "矩阵数值题",
  "表格数值题",
  "表格填空题",
  "表格组合题",
  "表格自增题",
  "多项文件题",
  "多项简答题",
  "投票单选",
  "投票多选",
  "Maxdiff",
  "当前语音",
] as const;

const QTYPE_ALIAS_MAP: Record<string, string> = {
  "表格数值题": "表格数值",
  "表格填空题": "表格填空",
  "表格组合题": "表格组合",
  "表格自增题": "自增表格",
};

export const JSONL_SUPPORTED_QTYPES: ReadonlySet<string> = new Set([
  ...DOCUMENTED_JSONL_QTYPES,
  ...ADDITIONAL_JSONL_QTYPES,
]);

/**
 * qtypes whose minimal JSONL representation is only a shell. They need
 * assets, AI/relationship configuration, or page timing to become a usable
 * survey in the editor, so an omitted `publish` must leave the survey as a
 * draft. Explicit `publish: true` remains an intentional user override.
 */
export const FRAMEWORK_ONLY_JSONL_QTYPES: ReadonlySet<string> = new Set([
  "折叠栏目",
  "轮播图",
  "AI追问",
  "AI处理",
  "AI访谈",
  "图片OCR",
  "VlookUp问卷关联",
  "分页计时器",
]);

/** Return whether a JSONL document contains a known shell-only qtype. */
export function hasFrameworkOnlyJsonlQtype(jsonlText: string): boolean {
  for (const line of jsonlText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (typeof parsed.qtype !== "string") continue;
      const canonical = QTYPE_ALIAS_MAP[parsed.qtype] ?? parsed.qtype;
      if (FRAMEWORK_ONLY_JSONL_QTYPES.has(canonical)) return true;
    } catch {
      // Strict JSONL parsing happens before this helper is used by creation.
    }
  }
  return false;
}

/** Resolve the wire publish flag while preserving an explicit caller choice. */
export function resolveJsonlPublish(jsonlText: string, requested?: boolean): boolean {
  if (requested !== undefined) return requested;
  return !hasFrameworkOnlyJsonlQtype(jsonlText);
}

// ─── JSONL parsing ──────────────────────────────────────────────────

/**
 * Parse JSONL text (one JSON object per line) into an array of question objects.
 * 抛出带行号的错误信息以便定位。
 */
export function parseJsonl(jsonlText: string): JsonSurveyQuestion[] {
  const results: JsonSurveyQuestion[] = [];
  const lines = jsonlText.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      results.push(JSON.parse(line) as JsonSurveyQuestion);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`JSONL 第 ${i + 1} 行解析失败: ${msg}`);
    }
  }
  return results;
}

// ─── JSONL preflight ─────────────────────────────────────────────────

/** 已知 qtype 名（用于建议） */
const ALL_KNOWN_QTYPES = JSONL_SUPPORTED_QTYPES;

/** Levenshtein distance（小串足够用） */
function strDist(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, dp[j], dp[j - 1]) + 1;
      prev = tmp;
    }
  }
  return dp[b.length];
}

function suggestQtype(input: string): string | null {
  let best: { name: string; d: number } | null = null;
  for (const name of ALL_KNOWN_QTYPES) {
    const d = strDist(input, name);
    if (d <= 3 && (best === null || d < best.d)) {
      best = { name, d };
    }
  }
  return best?.name ?? null;
}

/**
 * 常见英文 qtype → 中文 qtype 的映射。命中时给出"请改中文"的明确提示，
 * 避免依赖 Levenshtein 猜测（英文→中文距离永远很大，suggest 永远为 null）。
 */
const ENGLISH_QTYPE_HINTS: Record<string, string> = {
  radio: "单选",
  single: "单选",
  single_choice: "单选",
  singlechoice: "单选",
  checkbox: "多选",
  multiple: "多选",
  multi: "多选",
  multiple_choice: "多选",
  multiplechoice: "多选",
  text: "单项填空",
  textarea: "简答题",
  input: "单项填空",
  fillblank: "单项填空",
  fill_blank: "单项填空",
  rating: "量表题",
  scale: "量表题",
  likert: "量表题",
  nps: "NPS量表",
  matrix: "矩阵单选",
  matrix_single: "矩阵单选",
  matrix_multiple: "矩阵多选",
  matrix_scale: "矩阵量表",
  rank: "排序",
  ranking: "排序",
  sort: "排序",
  slider: "滑动条",
  dropdown: "下拉框",
  select: "下拉框",
  upload: "文件上传",
  file: "文件上传",
  date: "日期",
  vote: "投票单选",
  voting: "投票单选",
  survey_meta: "问卷基础信息",
  meta: "问卷基础信息",
  metadata: "问卷基础信息",
  header: "问卷基础信息",
};

function matchEnglishQtype(input: string): string | null {
  const key = input.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return ENGLISH_QTYPE_HINTS[key] ?? null;
}

/**
 * JSONL 预检：在交给后续解析前，扫一遍每行结构，发现典型 AI 写错的形态时
 * 抛出**带定位 + 修复建议**的错误，避免后续抛出晦涩的 "qtype 不识别"/"标题缺失"。
 *
 * 检测项（按优先级）：
 * 1. 第一行非"问卷基础信息" → 提示加首行元数据
 * 2. 行用了 `q_type`/`type` 字段但缺 `qtype` → 提示用中文 qtype（字符串）
 * 3. `qtype` 是数字（误把 q_type 数字塞过来）→ 列出常见中文映射
 * 4a. `qtype` 是英文（radio/checkbox/rating 等）→ 给出精确的中文替换
 * 4b. `qtype` 字符串但不在 JSONL_SUPPORTED_QTYPES → 给出"你是不是想写 X"
 */
export function preflightJsonl(jsonlText: string): void {
  const lines = jsonlText.split("\n");
  let firstNonEmptyLineIndex = -1;
  let firstNonEmptyObj: Record<string, unknown> | null = null;
  let metadataLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(
        `JSONL 第 ${i + 1} 行必须是 JSON 对象，不能是 ${parsed === null ? "null" : Array.isArray(parsed) ? "数组" : typeof parsed}`,
      );
    }
    const obj = parsed as Record<string, unknown>;
    if (firstNonEmptyLineIndex === -1) {
      firstNonEmptyLineIndex = i;
      firstNonEmptyObj = obj;
    }

    if (obj.qtype === "问卷基础信息") {
      if (metadataLineIndex !== -1) {
        throw new Error(
          `JSONL 第 ${i + 1} 行重复声明"问卷基础信息"；元数据只能出现一次（第 ${metadataLineIndex + 1} 行）。`,
        );
      }
      metadataLineIndex = i;
    }

    // 检测 2：用了 q_type/type 但没有 qtype
    if (typeof obj.qtype === "undefined") {
      if ("q_type" in obj || "type" in obj) {
        throw new Error(
          `JSONL 第 ${i + 1} 行字段名错误：找到 ${"q_type" in obj ? "`q_type`" : "`type`"} 但缺少 \`qtype\`。` +
          `本工具用中文字符串 \`qtype\` 区分题型（不是数字 q_type）。` +
          `修复：把 ${"q_type" in obj ? "q_type" : "type"} 字段改名为 qtype，并填中文题型名。` +
          `常见值："单选"、"多选"、"填空"、"量表题"、"矩阵单选"、"矩阵量表"、"投票单选"、"问卷基础信息"。` +
          `运行 \`wjx survey jsonl-template\` 获取完整骨架。`,
        );
      }
      // qtype 缺失但也没有 q_type/type，可能是非题目数据，跳过
      continue;
    }

    // 检测 3：qtype 是数字
    if (typeof obj.qtype !== "string") {
      throw new Error(
        `JSONL 第 ${i + 1} 行 qtype 必须是中文字符串（如 "单选"），收到类型：${typeof obj.qtype}。` +
        `修复：qtype 字段填中文题型名，例如 \`"qtype": "单选"\`。` +
        `运行 \`wjx survey jsonl-template\` 获取完整骨架。`,
      );
    }

    // 检测 4：qtype 字符串但不识别
    const normalized = QTYPE_ALIAS_MAP[obj.qtype] ?? obj.qtype;
    if (!JSONL_SUPPORTED_QTYPES.has(normalized)) {
      // 4a：英文 qtype（radio/checkbox/rating/...）→ 明确告诉要用中文
      const englishMatch = matchEnglishQtype(obj.qtype);
      if (englishMatch) {
        throw new Error(
          `JSONL 第 ${i + 1} 行 qtype "${obj.qtype}" 是英文值，本工具只接受中文 qtype。` +
          `修复：改成 \`"qtype": "${englishMatch}"\`。` +
          `其他常见映射：radio→单选, checkbox→多选, rating/scale→量表题, matrix→矩阵单选, rank→排序, dropdown→下拉框, upload→文件上传。` +
          `完整列表见 references/question-types.md，或运行 \`wjx survey jsonl-template\` 获取骨架。`,
        );
      }
      // 4b：中文但拼错（Levenshtein 距离 ≤ 3）
      const suggestion = suggestQtype(obj.qtype);
      const hint = suggestion ? `你是不是想写 "${suggestion}"？` : "";
      throw new Error(
        `JSONL 第 ${i + 1} 行 qtype "${obj.qtype}" 不识别。${hint} ` +
        `常见值："单选"、"多选"、"填空"、"量表题"、"矩阵单选"、"矩阵量表"、"投票单选"、"投票多选"、"表格数值"、"表格填空"、"问卷基础信息"。` +
        `完整列表见 references/question-types.md，或运行 \`wjx survey jsonl-template\` 获取骨架。`,
      );
    }

    // NPS is a protocol-level question shape, not a generic 0-10 scale.
    // Keep the canonical eleven string options enforced before any wire
    // conversion so CLI, SDK and MCP callers share the same boundary.
    if (normalized === "NPS量表") {
      const select = obj.select;
      const valid = Array.isArray(select)
        && select.length === 11
        && select.every((value, index) => typeof value === "string" && value === String(index));
      if (!valid) {
        throw new Error(
          `JSONL 第 ${i + 1} 行 NPS量表的 select 必须严格是 ["0","1",...,"10"] 的 11 个字符串。` +
          `不能省略、缩短、改成数字或用 minvalue/maxvalue 替代。` +
          `修复：补齐 select 为从 "0" 到 "10" 的完整字符串序列。`,
        );
      }
    }
  }

  // 检测 1：首行非"问卷基础信息"
  if (firstNonEmptyObj && firstNonEmptyObj.qtype !== "问卷基础信息") {
    throw new Error(
      `JSONL 第 ${firstNonEmptyLineIndex + 1} 行（首个非空行）不是"问卷基础信息"。` +
      `JSONL 必须以一行元数据开头：\`{"qtype":"问卷基础信息","title":"你的问卷标题"}\`，紧接着每行一道题。` +
      `运行 \`wjx survey jsonl-template\` 获取完整骨架，或 \`wjx survey jsonl-template --type 3\` 获取投票模板。`,
    );
  }
}

/**
 * Parse JSONL text into a structured survey: extract metadata from "问卷基础信息" entry,
 * remaining entries become the questions array.
 */
export function jsonToSurvey(jsonlText: string): JsonParsedSurvey {
  preflightJsonl(jsonlText);
  const all = parseJsonl(jsonlText);

  let title = "";
  let description = "";
  let endpageinformation = "";
  let language = "zh";
  const questions: JsonSurveyQuestion[] = [];

  for (const item of all) {
    if (item.qtype === "问卷基础信息") {
      title = (item.title as string) ?? "";
      description = (item.introduction as string) ?? "";
      endpageinformation = (item.endpageinformation as string) ?? "";
      language = (item.language as string) ?? "zh";
    } else {
      questions.push(item);
    }
  }

  return { title, description, endpageinformation, language, questions };
}
