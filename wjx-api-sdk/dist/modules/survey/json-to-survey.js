/** createSurveyByJson 的 JSONL 大小上限（1 MB） */
export const MAX_JSONL_SIZE = 1_000_000;
// ─── 标准化预处理 ──────────────────────────────────────────────────
/**
 * 对 JSONL 文本做标准化预处理：
 * - 剥离 BOM（Windows UTF-8 BOM）
 * - CRLF → LF
 */
export function normalizeJsonl(jsonl) {
    return jsonl.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}
// ─── JSONL 元数据提取（轻量快速路径） ──────────────────────────────
/**
 * 从 JSONL 文本中提取首行 "问卷基础信息" 的元数据（title / description 等）。
 * 仅做最小解析：找到第一个 qtype === "问卷基础信息" 的行即返回。
 * 与 `jsonToSurvey` 不同的是：不解析所有题目、出错不抛异常、适合快速元数据读取。
 */
export function extractJsonlMetadata(jsonlText) {
    const lines = jsonlText.split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        try {
            const obj = JSON.parse(trimmed);
            if (obj.qtype === "问卷基础信息") {
                const rawAtype = obj.atype;
                const atype = typeof rawAtype === "number" && Number.isFinite(rawAtype)
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
        }
        catch {
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
export const EXAM_QTYPES = new Set([
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
 * - 为每道考试题自动注入 `isquiz="1"`（用户已显式设置则保留原值）
 *
 * 非考试题、_meta 行、空行、无法解析的行保持原样。
 */
export function preprocessExamJsonl(jsonl) {
    const lines = jsonl.split("\n");
    let hasExam = false;
    const processed = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed)
            return line;
        let obj;
        try {
            obj = JSON.parse(trimmed);
        }
        catch {
            return line;
        }
        if (typeof obj.qtype === "string" && EXAM_QTYPES.has(obj.qtype)) {
            hasExam = true;
            if (obj.isquiz === undefined) {
                obj.isquiz = "1";
                return JSON.stringify(obj);
            }
        }
        return line;
    });
    return { jsonl: processed.join("\n"), hasExam };
}
// ─── 默认必答预处理 ─────────────────────────────────────────────────
/**
 * 非题目类 qtype（这些不需要注入 requir 字段）。
 */
const NON_QUESTION_QTYPES = new Set([
    "问卷基础信息",
    "分页栏",
    "段落说明",
    "知情同意书",
]);
/**
 * 扫描 JSONL 文本，为所有题目行注入 `requir: true`（用户未显式指定时）。
 * - 与页面创建行为保持一致：默认必答
 * - 非题目行（问卷基础信息、分页栏、段落说明、知情同意书）和空行/无法解析行保持原样
 */
export function injectDefaultRequir(jsonl) {
    const lines = jsonl.split("\n");
    const processed = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed)
            return line;
        let obj;
        try {
            obj = JSON.parse(trimmed);
        }
        catch {
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
export function injectAtypeIntoJsonl(jsonl, atype) {
    const lines = jsonl.split("\n");
    let injected = false;
    const out = lines.map((line) => {
        if (injected)
            return line;
        const trimmed = line.trim();
        if (!trimmed)
            return line;
        let obj;
        try {
            obj = JSON.parse(trimmed);
        }
        catch {
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
export function inferAtypeFromTitle(title) {
    if (!title)
        return undefined;
    if (title.includes("投票"))
        return 3;
    if (title.includes("考试") || title.includes("试卷") || title.includes("测试题"))
        return 6;
    if (/表单|报名表|登记表|申请表/.test(title))
        return 7;
    if (title.includes("测评"))
        return 2;
    return undefined;
}
// ─── 标题 & 题目数合理性校验 ────────────────────────────────────────
/**
 * 已知占位符标题黑名单（命中则拦截）。
 * 只收录明显无语义、绝对不该落库的值；真实问卷主题（如 "客户满意度调查"）不会命中。
 */
const PLACEHOLDER_TITLES = new Set([
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
export function validateSurveyTitle(rawTitle) {
    const title = (rawTitle ?? "").trim();
    const actionHint = '请在 JSONL 首行 {"qtype":"问卷基础信息","title":"..."} 中填写真实问卷主题' +
        '（例："2026 年员工满意度调查"、"新产品上市用户测试"），' +
        "或在调用 create_survey_by_json 时传入 title 参数显式覆盖。";
    if (!title) {
        throw new Error(`问卷标题缺失：未在 JSONL 中找到有效的标题。${actionHint}`);
    }
    if (/^[?？\s]+$/.test(title)) {
        throw new Error(`问卷标题无效（"${rawTitle}"）：疑似 LLM 占位输出或编码错误。${actionHint}`);
    }
    if (title.length < 2) {
        throw new Error(`问卷标题过短（"${rawTitle}"）：至少需要 2 个字符。${actionHint}`);
    }
    if (PLACEHOLDER_TITLES.has(title.toLowerCase())) {
        throw new Error(`问卷标题为占位符（"${rawTitle}"）：禁止使用 无标题/未命名/untitled/placeholder/TODO/xxx 等无语义值。${actionHint}`);
    }
}
/**
 * 非题目类 qtype 只读集合（对外暴露，供调用方自行判断题目行）。
 * 语义与内部的 NON_QUESTION_QTYPES 一致。
 */
export const NON_QUESTION_QTYPE_SET = NON_QUESTION_QTYPES;
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
export function validateSurveyHasQuestions(jsonl) {
    let questionCount = 0;
    for (const line of jsonl.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        let obj;
        try {
            obj = JSON.parse(trimmed);
        }
        catch {
            continue;
        }
        if (typeof obj.qtype !== "string")
            continue;
        if (NON_QUESTION_QTYPES.has(obj.qtype))
            continue;
        questionCount++;
    }
    if (questionCount < 1) {
        throw new Error("问卷中未找到有效题目：JSONL 仅包含元数据/分页栏/段落说明/知情同意书，没有真正的题目。" +
            "请在 JSONL 中添加至少 1 道题目（如 {\"qtype\":\"单选\",\"title\":\"...\",\"select\":[...]}）。" +
            "如果你是 AI Agent，请重新按主题生成完整题目列表，不要只输出 _meta 行。");
    }
}
// ─── qtype → q_type/q_subtype mapping ──────────────────────────────
/** qtype 中文名 → API wire format { q_type, q_subtype } 映射表 */
export const QTYPE_MAP = {
    // ── 基础选择题 ──
    "单选": { q_type: 3, q_subtype: 3 },
    "多选": { q_type: 4, q_subtype: 4 },
    "下拉框": { q_type: 3, q_subtype: 301 },
    "排序": { q_type: 4, q_subtype: 402 },
    // ── 填空题 ──
    "单项填空": { q_type: 5, q_subtype: 5 },
    "简答题": { q_type: 5, q_subtype: 5 },
    "多项填空": { q_type: 6, q_subtype: 6 },
    "矩阵填空": { q_type: 7, q_subtype: 704 },
    // ── 量表 / 评分题 ──
    "量表题": { q_type: 3, q_subtype: 302 },
    "NPS量表": { q_type: 3, q_subtype: 302 },
    "评分单选": { q_type: 3, q_subtype: 303 },
    "评分多选": { q_type: 4, q_subtype: 401 },
    "评价题": { q_type: 3, q_subtype: 303 },
    // ── 矩阵题 ──
    "矩阵单选": { q_type: 7, q_subtype: 702 },
    "矩阵多选": { q_type: 7, q_subtype: 703 },
    "矩阵量表": { q_type: 7, q_subtype: 701 },
    "矩阵滑动条": { q_type: 7, q_subtype: 705 },
    // 注意：矩阵数值题 706 在服务端可能被降级为普通填空 5/5（依赖问卷类型与字段配置）
    "矩阵数值题": { q_type: 7, q_subtype: 706 },
    "表格填空题": { q_type: 7, q_subtype: 707 },
    "表格下拉框": { q_type: 7, q_subtype: 708 },
    "表格组合题": { q_type: 7, q_subtype: 709 },
    "表格自增题": { q_type: 7, q_subtype: 710 },
    "多项文件题": { q_type: 7, q_subtype: 711 },
    "多项简答题": { q_type: 7, q_subtype: 712 },
    // ── 数值 / 滑动条 / 比重 ──
    "滑动条": { q_type: 10, q_subtype: 10 },
    "比重题": { q_type: 9, q_subtype: 9 },
    // ── 文件 / 上传 ──
    "文件上传": { q_type: 8, q_subtype: 8 },
    // ── 下拉 / 级联 ──
    "多级下拉": { q_type: 5, q_subtype: 501 },
    "门店选择": { q_type: 5, q_subtype: 501 },
    // ── 日期 ──
    "日期": { q_type: 5, q_subtype: 5 },
    // ── 页面结构 ──
    "分页栏": { q_type: 1, q_subtype: 1 },
    "段落说明": { q_type: 2, q_subtype: 2 },
    // ── AI 题型 ──
    "AI追问": { q_type: 5, q_subtype: 5 },
    "AI处理": { q_type: 5, q_subtype: 5 },
    "AI访谈": { q_type: 5, q_subtype: 5 },
    // ── 专业调查模型 ──
    "情景随机": { q_type: 3, q_subtype: 304 },
    "BWS": { q_type: 3, q_subtype: 3 },
    "MaxDiff": { q_type: 3, q_subtype: 3 },
    "Maxdiff": { q_type: 3, q_subtype: 3 },
    "图片PK": { q_type: 3, q_subtype: 3 },
    "联合分析": { q_type: 7, q_subtype: 702 },
    "Kano模型": { q_type: 7, q_subtype: 701 },
    "SUS模型": { q_type: 7, q_subtype: 701 },
    "品牌漏斗": { q_type: 4, q_subtype: 4 },
    "货架题": { q_type: 4, q_subtype: 403 },
    "BPTO模型": { q_type: 7, q_subtype: 701 },
    "PSM模型": { q_type: 10, q_subtype: 10 },
    "价格断裂点": { q_type: 7, q_subtype: 701 },
    "层次分析": { q_type: 7, q_subtype: 702 },
    "选项分类": { q_type: 7, q_subtype: 703 },
    "CATI调研": { q_type: 3, q_subtype: 3 },
    "文字点睛": { q_type: 7, q_subtype: 702 },
    "心理学实验": { q_type: 5, q_subtype: 5 },
    "VlookUp问卷关联": { q_type: 5, q_subtype: 5 },
    "循环评价": { q_type: 7, q_subtype: 702 },
    "热力图": { q_type: 8, q_subtype: 8 },
    // ── 预设题型 ──
    "姓名": { q_type: 5, q_subtype: 5 },
    "基本信息": { q_type: 7, q_subtype: 704 },
    "身份证号": { q_type: 5, q_subtype: 5 },
    // 注意：以下地区/高校预设在无额外字段（如 relation/leveldata）时，
    // 服务端可能降级为普通填空 5/5。若需多级下拉效果，建议显式使用 qtype="多级下拉" + leveldata。
    "国家及地区": { q_type: 5, q_subtype: 501 },
    "省市": { q_type: 5, q_subtype: 501 },
    "省市区": { q_type: 5, q_subtype: 501 },
    "邮箱": { q_type: 5, q_subtype: 5 },
    "手机": { q_type: 5, q_subtype: 5 },
    "高校": { q_type: 5, q_subtype: 501 },
    "邮寄地址": { q_type: 7, q_subtype: 704 },
    "社会阶层": { q_type: 7, q_subtype: 701 },
    "企业信息": { q_type: 7, q_subtype: 704 },
    "知情同意书": { q_type: 2, q_subtype: 2 },
    // ── 系统字段 ──
    "设备信息": { q_type: 5, q_subtype: 5 },
    "城市级别": { q_type: 5, q_subtype: 5 },
    "当前语言": { q_type: 5, q_subtype: 5 },
    "当前语音": { q_type: 5, q_subtype: 5 },
    "答题录音": { q_type: 8, q_subtype: 8 },
    "答卷摄像": { q_type: 8, q_subtype: 8 },
    "分页计时器": { q_type: 5, q_subtype: 5 },
    // ── 考试题型 ──
    "考试单选": { q_type: 3, q_subtype: 3 },
    "考试判断": { q_type: 3, q_subtype: 305 },
    "考试多选": { q_type: 4, q_subtype: 4 },
    "考试单项填空": { q_type: 5, q_subtype: 5 },
    "考试多项填空": { q_type: 6, q_subtype: 6 },
    "考试简答": { q_type: 5, q_subtype: 5 },
    "考试文件": { q_type: 8, q_subtype: 8 },
    "考试绘图": { q_type: 8, q_subtype: 801 },
    "考试代码": { q_type: 5, q_subtype: 5 },
};
/** Subtypes that need auto-incrementing item_score (量表302, 评分单选303, 评分多选401) */
const SCORING_SUBTYPES = new Set([302, 303, 401]);
// ─── JSONL parsing ──────────────────────────────────────────────────
/**
 * Parse JSONL text (one JSON object per line) into an array of question objects.
 * 抛出带行号的错误信息以便定位。
 */
export function parseJsonl(jsonlText) {
    const results = [];
    const lines = jsonlText.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line)
            continue;
        try {
            results.push(JSON.parse(line));
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            throw new Error(`JSONL 第 ${i + 1} 行解析失败: ${msg}`);
        }
    }
    return results;
}
/**
 * Parse JSONL text into a structured survey: extract metadata from "问卷基础信息" entry,
 * remaining entries become the questions array.
 */
export function jsonToSurvey(jsonlText) {
    const all = parseJsonl(jsonlText);
    let title = "";
    let description = "";
    let endpageinformation = "";
    let language = "zh";
    const questions = [];
    for (const item of all) {
        if (item.qtype === "问卷基础信息") {
            title = item.title ?? "";
            description = item.introduction ?? "";
            endpageinformation = item.endpageinformation ?? "";
            language = item.language ?? "zh";
        }
        else {
            questions.push(item);
        }
    }
    return { title, description, endpageinformation, language, questions };
}
// ─── JSON questions → API wire format ───────────────────────────────
/**
 * Convert an array of JsonSurveyQuestion to API wire format (question JSON for createSurvey).
 * Unknown qtype entries are collected as `skippedTypes` rather than throwing —
 * 调用方若需要严格校验，可在拿到结果后自行检查 `skippedTypes.length === 0`。
 */
export function jsonQuestionsToWire(questions) {
    const wire = [];
    const skippedTypes = [];
    let qIdx = 1;
    for (const q of questions) {
        const typeInfo = QTYPE_MAP[q.qtype];
        if (!typeInfo) {
            skippedTypes.push({ qtype: q.qtype, title: q.title ?? "" });
            continue;
        }
        const wq = {
            q_index: qIdx,
            q_type: typeInfo.q_type,
            q_subtype: typeInfo.q_subtype,
            q_title: q.title ?? "",
            is_requir: q.requir !== false,
        };
        // ── 选项 items 构建 ──
        if (isMatrixLikeType(q.qtype)) {
            // 矩阵类：rowtitle → items（行标题），select → col_items（列选项）
            if (q.rowtitle && q.rowtitle.length > 0) {
                wq.items = q.rowtitle.map((row, i) => ({
                    q_index: qIdx,
                    item_index: i + 1,
                    item_title: row,
                }));
            }
            if (q.select && q.select.length > 0) {
                wq.col_items = q.select.map((col, i) => ({
                    q_index: qIdx,
                    item_index: i + 1,
                    item_title: col,
                }));
            }
        }
        else if (isWeightType(q.qtype)) {
            // 比重题：rowtitle → items
            if (q.rowtitle && q.rowtitle.length > 0) {
                wq.items = q.rowtitle.map((row, i) => ({
                    q_index: qIdx,
                    item_index: i + 1,
                    item_title: row,
                }));
            }
        }
        else if (isMaxDiffType(q.qtype)) {
            // BWS / MaxDiff / 图片PK：mdattr → items
            const attrs = q.mdattr ?? q.select;
            if (attrs && attrs.length > 0) {
                wq.items = attrs.map((attr, i) => ({
                    q_index: qIdx,
                    item_index: i + 1,
                    item_title: attr,
                }));
            }
        }
        else if (q.qtype === "品牌漏斗") {
            // 品牌漏斗：brands → items
            const brands = q.brands ?? q.select;
            if (brands && brands.length > 0) {
                wq.items = brands.map((b, i) => ({
                    q_index: qIdx,
                    item_index: i + 1,
                    item_title: b,
                }));
            }
        }
        else if (q.qtype === "联合分析") {
            // 联合分析：columntitle → col_items
            if (q.columntitle && q.columntitle.length > 0) {
                wq.col_items = q.columntitle.map((col, i) => ({
                    q_index: qIdx,
                    item_index: i + 1,
                    item_title: col,
                }));
            }
        }
        else if (isSliderType(q.qtype)) {
            // 滑动条 / 矩阵滑动条：minvalue/maxvalue → items
            if (q.minvalue !== undefined && q.maxvalue !== undefined) {
                const min = parseInt(q.minvalue, 10);
                const max = parseInt(q.maxvalue, 10);
                if (!isNaN(min) && !isNaN(max) && max - min + 1 <= 100) {
                    wq.items = [];
                    for (let v = min; v <= max; v++) {
                        wq.items.push({ q_index: qIdx, item_index: v - min + 1, item_title: String(v) });
                    }
                }
                else {
                    wq.items = [
                        { q_index: qIdx, item_index: 1, item_title: q.minvalue },
                        { q_index: qIdx, item_index: 2, item_title: q.maxvalue },
                    ];
                }
            }
        }
        else if (q.select && q.select.length > 0) {
            // 普通选择题：select → items
            wq.items = q.select.map((opt, i) => ({
                q_index: qIdx,
                item_index: i + 1,
                item_title: opt,
            }));
        }
        // ── 矩阵填空 / 基本信息 / 邮寄地址：rowtitle → items（无 col_items） ──
        if (isMatrixFillType(q.qtype) && q.rowtitle && q.rowtitle.length > 0 && !wq.items) {
            wq.items = q.rowtitle.map((row, i) => ({
                q_index: qIdx,
                item_index: i + 1,
                item_title: row,
            }));
        }
        // ── 多项填空：自动补 {_} 占位符 ──
        if (typeInfo.q_type === 6 && !wq.q_title.includes("{_}")) {
            const count = (q.select && q.select.length > 0) ? q.select.length : 2;
            const gapMatch = wq.q_title.match(/________/g) || wq.q_title.match(/_____/g);
            if (!gapMatch) {
                const placeholders = Array.from({ length: count }, () => "{_}").join("，");
                const separator = /[：:，,、。.；;）)》>\s]$/.test(wq.q_title) ? "" : "：";
                wq.q_title = `${wq.q_title}${separator}${placeholders}`;
            }
        }
        // ── 自动 item_score（量表302, 评分单选303, 评分多选401） ──
        if (SCORING_SUBTYPES.has(typeInfo.q_subtype) && wq.items) {
            for (const item of wq.items) {
                if (item.item_score === undefined) {
                    item.item_score = item.item_index;
                }
            }
        }
        if (SCORING_SUBTYPES.has(typeInfo.q_subtype) && wq.col_items) {
            for (const item of wq.col_items) {
                if (item.item_score === undefined) {
                    item.item_score = item.item_index;
                }
            }
        }
        wire.push(wq);
        qIdx++;
    }
    return { questions: wire, skippedTypes };
}
// ─── Helper predicates ──────────────────────────────────────────────
function isMatrixLikeType(qtype) {
    return [
        "矩阵单选", "矩阵多选", "矩阵量表", "矩阵滑动条", "矩阵数值题",
        "表格下拉框", "表格组合题",
        "Kano模型", "SUS模型", "BPTO模型", "价格断裂点",
        "层次分析", "选项分类", "文字点睛", "循环评价",
        "社会阶层", "PSM模型",
    ].includes(qtype);
}
function isMatrixFillType(qtype) {
    return [
        "矩阵填空", "基本信息", "邮寄地址", "企业信息",
        "表格填空题", "表格自增题", "多项文件题", "多项简答题",
    ].includes(qtype);
}
function isWeightType(qtype) {
    return qtype === "比重题";
}
function isMaxDiffType(qtype) {
    return ["BWS", "MaxDiff", "Maxdiff", "图片PK"].includes(qtype);
}
function isSliderType(qtype) {
    return ["滑动条"].includes(qtype);
}
//# sourceMappingURL=json-to-survey.js.map