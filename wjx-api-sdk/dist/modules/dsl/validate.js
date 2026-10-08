export const MAX_WJX_DSL_BYTES = 4 * 1024 * 1024;
const MAX_FILE_UPLOAD_SIZE = 2048000;
function diagnostic(code, message, line) {
    return { severity: "Error", code, message, ...(line === undefined ? {} : { line }) };
}
export function maskDslComments(value) {
    const chars = value.split("");
    let quote = false;
    let escaped = false;
    let lineComment = false;
    let blockComment = false;
    for (let i = 0; i < chars.length; i += 1) {
        const current = chars[i];
        const next = chars[i + 1];
        if (lineComment) {
            if (current === "\n" || current === "\r")
                lineComment = false;
            else
                chars[i] = " ";
            continue;
        }
        if (blockComment) {
            if (current === "*" && next === "/") {
                chars[i] = " ";
                chars[i + 1] = " ";
                i += 1;
                blockComment = false;
            }
            else if (current !== "\n" && current !== "\r")
                chars[i] = " ";
            continue;
        }
        if (quote) {
            if (escaped)
                escaped = false;
            else if (current === "\\")
                escaped = true;
            else if (current === '"')
                quote = false;
            continue;
        }
        if (current === '"')
            quote = true;
        else if (current === "/" && next === "/") {
            chars[i] = " ";
            chars[i + 1] = " ";
            i += 1;
            lineComment = true;
        }
        else if (current === "/" && next === "*") {
            chars[i] = " ";
            chars[i + 1] = " ";
            i += 1;
            blockComment = true;
        }
        else if (current === "#") {
            chars[i] = " ";
            lineComment = true;
        }
    }
    return chars.join("");
}
export function matchingBrace(value, openIndex) {
    let depth = 0;
    let quote = false;
    let escaped = false;
    for (let i = openIndex; i < value.length; i += 1) {
        const current = value[i];
        if (quote) {
            if (escaped)
                escaped = false;
            else if (current === "\\")
                escaped = true;
            else if (current === '"')
                quote = false;
            continue;
        }
        if (current === '"')
            quote = true;
        else if (current === "{")
            depth += 1;
        else if (current === "}" && --depth === 0)
            return i;
    }
    return -1;
}
function topLevelAttribute(body, name) {
    const pattern = new RegExp(`\\battr\\s+(?:"${name}"|${name})\\s*=\\s*(?:"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"|([^;\\s]+))`, "i");
    let depth = 0;
    let quote = false;
    let escaped = false;
    for (let i = 0; i < body.length; i += 1) {
        const current = body[i];
        if (quote) {
            if (escaped)
                escaped = false;
            else if (current === "\\")
                escaped = true;
            else if (current === '"')
                quote = false;
            continue;
        }
        if (current === '"')
            quote = true;
        else if (current === "{")
            depth += 1;
        else if (current === "}")
            depth -= 1;
        if (depth !== 0 || !body.startsWith("attr", i))
            continue;
        const match = pattern.exec(body.slice(i));
        if (match && match.index === 0)
            return match[1] ?? match[2] ?? "";
    }
    return undefined;
}
function lineNumber(value, index) {
    let line = 1;
    for (let i = 0; i < index; i += 1)
        if (value[i] === "\n")
            line += 1;
    return line;
}
export function isInsideQuotedString(value, index) {
    let quote = false;
    let escaped = false;
    for (let i = 0; i < index; i += 1) {
        const current = value[i];
        if (quote) {
            if (escaped)
                escaped = false;
            else if (current === "\\")
                escaped = true;
            else if (current === '"')
                quote = false;
        }
        else if (current === '"') {
            quote = true;
        }
    }
    return quote;
}
function validateFileUploadMaxSizes(value, diagnostics) {
    const masked = maskDslComments(value);
    const candidatePattern = /\bquestion(?:\s+(fileupload|signature|drawing|psych|psych_embed|experiment_embed))?\s*\{|\bnode\s+"Question"\s*\{/gi;
    let match;
    while ((match = candidatePattern.exec(masked)) !== null) {
        if (isInsideQuotedString(masked, match.index))
            continue;
        const openIndex = masked.indexOf("{", match.index);
        const closeIndex = matchingBrace(masked, openIndex);
        if (openIndex < 0 || closeIndex < 0)
            continue;
        const body = value.slice(openIndex + 1, closeIndex);
        const alias = (match[1] ?? "").toLowerCase();
        const type = ["psych", "psych_embed", "experiment_embed"].includes(alias)
            ? "fileupload"
            : alias || (topLevelAttribute(body, "Type") ?? "").toLowerCase();
        if (type !== "fileupload")
            continue;
        const maxSize = topLevelAttribute(body, "MaxSize");
        if (maxSize === undefined && ["signature", "drawing", "psych", "psych_embed", "experiment_embed"].includes(alias))
            continue;
        const parsed = maxSize === undefined ? NaN : Number(maxSize);
        if (maxSize === undefined || !/^\d+$/.test(maxSize) || !Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_FILE_UPLOAD_SIZE) {
            diagnostics.push(diagnostic("DSL_FILE_LIMIT", "fileupload MaxSize must be explicitly set to an integer from 1 to 2048000.", lineNumber(value, openIndex)));
        }
    }
}
function validateLevelDataShape(body, diagnostics) {
    const verify = (topLevelAttribute(body, "Verify") ?? "").trim();
    if (verify !== "多级下拉")
        return;
    const levelData = topLevelAttribute(body, "LevelData");
    if (!levelData)
        return;
    // DSL string literals carry editor line breaks as the two-character escape
    // `\\n`; normalize it before inspecting the editor's data blocks.
    const normalizedLevelData = levelData.replace(/\\n/g, "\n");
    const segments = normalizedLevelData.split("〒");
    // The server parser requires exactly one separator between the data blocks
    // and the level-title block. Extra separators turn full paths into fake
    // levels; a missing separator makes the server discard the cascade data.
    if (segments.length !== 2) {
        diagnostics.push(diagnostic("DSL_LEVELDATA_SHAPE", "多级下拉 LevelData 格式错误：只能使用一个 `〒` 分隔级别标题；各级数据块用 `|` 分隔，并用 `---父级路径` + 换行声明子级。不要用多个 `〒` 连接完整路径。"));
        return;
    }
    const blocks = (segments[0] ?? "").split("|");
    const rootOptions = new Set((blocks[0] ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("---")));
    if (rootOptions.size === 0) {
        diagnostics.push(diagnostic("DSL_LEVELDATA_PARENT", "多级下拉 LevelData 必须先用换行声明至少一个一级选项。"));
    }
    for (let index = 1; index < blocks.length; index += 1) {
        const previousOptions = new Set((blocks[index - 1] ?? "")
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith("---")));
        const coveredParents = new Set();
        let currentParent;
        for (const rawLine of (blocks[index] ?? "").split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line)
                continue;
            if (line.startsWith("---")) {
                const parent = line.slice(3).trim();
                if (!parent) {
                    diagnostics.push(diagnostic("DSL_LEVELDATA_PARENT", "多级下拉 LevelData 的父标记不能只有 `---`。"));
                    currentParent = undefined;
                    continue;
                }
                if (!previousOptions.has(parent)) {
                    diagnostics.push(diagnostic("DSL_LEVELDATA_PARENT", `多级下拉 LevelData 的父节点「${parent}」不在上一级选项中；父标记必须使用上一级显示名称（例如 ---A栋），不能使用完整路径。`));
                }
                coveredParents.add(parent);
                currentParent = parent;
                continue;
            }
            if (!currentParent) {
                diagnostics.push(diagnostic("DSL_LEVELDATA_PARENT", "多级下拉 LevelData 的二级及以后数据块必须先使用 `---父级` 标记，再用换行列出子选项。"));
            }
        }
        for (const option of previousOptions) {
            if (!coveredParents.has(option)) {
                diagnostics.push(diagnostic("DSL_LEVELDATA_PARENT", `多级下拉 LevelData 的父节点「${option}」没有对应的子选项分组；每个上一级选项都必须有一个 ---父级标记。`));
            }
        }
    }
}
function countTopLevelBlocks(body, names) {
    const masked = maskDslComments(body);
    const wanted = new Set(names.map((name) => name.toLowerCase()));
    let depth = 0;
    let count = 0;
    const token = /(?:node\s+"([A-Za-z_][A-Za-z0-9_]*)"|([A-Za-z_][A-Za-z0-9_]*))\s*\{/g;
    let match;
    while ((match = token.exec(masked)) !== null) {
        const name = (match[1] ?? match[2]).toLowerCase();
        if (depth === 0 && wanted.has(name))
            count += 1;
        const open = masked.indexOf("{", match.index);
        const close = matchingBrace(masked, open);
        if (close >= 0)
            token.lastIndex = Math.max(token.lastIndex, close + 1);
    }
    return count;
}
function normalizedQuestionType(type, body) {
    const normalized = type.trim().toLowerCase();
    const aliases = {
        dropdown: { type: "radio_down" }, select: { type: "radio_down" },
        sort: { type: "check", mode: 1 }, ranking: { type: "check", mode: 1 },
        scale: { type: "radio", mode: 101 }, rating: { type: "radio", mode: 101 }, evaluate: { type: "radio", mode: 2, allowEmptyItems: true }, evaluation: { type: "radio", mode: 2, allowEmptyItems: true },
        true_false: { type: "radio" }, truefalse: { type: "radio" }, judgement: { type: "radio" }, panduan: { type: "radio" },
        scenario: { type: "radio" }, qingjing: { type: "radio" }, department: { type: "radio", allowEmptyItems: true }, commodity: { type: "check" }, shop: { type: "check" }, shelf: { type: "check" },
        appointment: { type: "check" }, reservation: { type: "check" },
        multi_level_dropdown: { type: "question" }, multilevel_dropdown: { type: "question" }, multilevel: { type: "question" },
        signature: { type: "fileupload" }, drawing: { type: "fileupload" }, psych: { type: "fileupload" }, psych_embed: { type: "fileupload" }, experiment_embed: { type: "fileupload" },
        scoring_single: { type: "radio" }, score_single: { type: "radio" }, scoring_multi: { type: "check" }, score_multi: { type: "check" },
        exam_multi_fill: { type: "gapfill" }, exam_cloze: { type: "gapfill" }, cloze: { type: "gapfill" },
        conjoint: { type: "matrix", mode: 302, skipShape: true }, maxdiff: { type: "matrix", mode: 302, skipShape: true }, bws: { type: "matrix", mode: 302, skipShape: true },
        circulate: { type: "matrix", mode: 302, skipShape: true }, image_pk: { type: "matrix", mode: 302, skipShape: true }, picture_pk: { type: "matrix", mode: 302, skipShape: true }, pkmode: { type: "matrix", mode: 302, skipShape: true }, kano: { type: "matrix", mode: 101, skipShape: true },
        ai_grading: { type: "question" }, texthighlights: { type: "matrix", mode: 103, skipShape: true }, text_highlights: { type: "matrix", mode: 103, skipShape: true },
        video: { type: "matrix", mode: 201, skipShape: true }, vlookup: { type: "matrix", mode: 201, skipShape: true }, ocr: { type: "matrix", mode: 201, skipShape: true }, sus: { type: "matrix", mode: 101, skipShape: true },
        bpto: { type: "matrix", mode: 302, skipShape: true }, price_breakpoint: { type: "matrix", mode: 101, skipShape: true }, price_break: { type: "matrix", mode: 101, skipShape: true },
        classify: { type: "matrix", mode: 103, skipShape: true }, device: { type: "matrix", mode: 201, skipShape: true }, company: { type: "matrix", mode: 201, skipShape: true },
        psm: { type: "matrix", mode: 202, skipShape: true }, level: { type: "matrix", mode: 103, skipShape: true }, test: { type: "matrix", mode: 302, skipShape: true },
        ai_interview: { type: "matrix", mode: 201, skipShape: true }, citylevel: { type: "radio", allowEmptyItems: true, skipShape: true }, radio_cati: { type: "radio", allowEmptyItems: true, skipShape: true },
        contacts_user: { type: "question" }, other_info: { type: "question" }, other_information: { type: "question" }, map: { type: "question" }, map_location: { type: "question" }, date: { type: "question" }, datetime: { type: "question" },
        ai: { type: "question" }, ai_followup: { type: "question" }, ai_hci: { type: "question" }, ai_hci_process: { type: "question" }, store_select: { type: "question" }, shop_select: { type: "question" },
        name: { type: "question" }, id_number: { type: "question" }, idcard: { type: "question" }, country_region: { type: "question" }, city_select: { type: "question" }, region: { type: "question" }, province_city: { type: "question" }, address_region: { type: "question" }, email: { type: "question" }, phone: { type: "question" }, mobile: { type: "question" }, university: { type: "question" }, password: { type: "question" },
        matrix_single: { type: "matrix", mode: 103 }, matrix_multi: { type: "matrix", mode: 102 }, matrix_scale: { type: "matrix", mode: 101 }, matrix_fill: { type: "matrix", mode: 201 }, matrix_slider: { type: "matrix", mode: 202 }, matrix_numeric: { type: "matrix", mode: 301 }, table_numeric: { type: "matrix", mode: 301 }, table_fill: { type: "matrix", mode: 302 }, table_question: { type: "matrix", mode: 302 }, table_dropdown: { type: "matrix", mode: 303 }, table_down: { type: "matrix", mode: 303 }, table_combo: { type: "matrix", mode: 302 }, table_incremental: { type: "matrix", mode: 302 }, multi_file: { type: "matrix", mode: 203 }, multifile: { type: "matrix", mode: 203 }, multi_textarea: { type: "matrix", mode: 204 }, multi_question: { type: "matrix", mode: 204 }, multiquestion: { type: "matrix", mode: 204 },
    };
    const mapped = aliases[normalized];
    if (mapped)
        return mapped;
    const explicitMode = Number(topLevelAttribute(body, "Mode"));
    const verify = (topLevelAttribute(body, "Verify") ?? "").trim().toLowerCase();
    const protocolMatrix = normalized === "matrix" && verify !== "" && verify !== "0" && verify !== "conjoint";
    return {
        type: normalized,
        ...(Number.isSafeInteger(explicitMode) ? { mode: explicitMode } : {}),
        ...(protocolMatrix ? { skipShape: true } : {}),
    };
}
function validateDuplicateTopics(value, diagnostics) {
    const masked = maskDslComments(value);
    const pattern = /\bquestion\s+[A-Za-z_][A-Za-z0-9_]*\s*\{|\bnode\s+"Question"\s*\{/gi;
    const topics = new Map();
    let match;
    while ((match = pattern.exec(masked)) !== null) {
        const open = masked.indexOf("{", match.index);
        const close = matchingBrace(masked, open);
        if (open < 0 || close < 0)
            continue;
        const body = value.slice(open + 1, close);
        const topic = topLevelAttribute(body, "Topic");
        if (topic === undefined || topic.trim() === "")
            continue;
        const line = lineNumber(value, match.index);
        const previous = topics.get(topic);
        if (previous !== undefined)
            diagnostics.push(diagnostic("DSL_DUPLICATE_TOPIC", `Topic ${topic} 重复（首次出现在第 ${previous} 行）。`, line));
        else
            topics.set(topic, line);
        pattern.lastIndex = close + 1;
    }
}
function allAttributeValues(body, name) {
    const pattern = new RegExp(`\\battr\\s+(?:"${name}"|${name})\\s*=\\s*(?:"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"|([^;\\s]+))`, "gi");
    const values = [];
    let match;
    while ((match = pattern.exec(body)) !== null)
        values.push(match[1] ?? match[2] ?? "");
    return values;
}
function isHttpUrl(value) {
    if (!value)
        return false;
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    }
    catch {
        return false;
    }
}
const VIDEO_EXTENSIONS = [".mp4", ".avi", ".mov", ".wmv", ".m3u8", ".flv", ".f4v", ".webm", ".m4v", ".3gp"];
function isDirectVideoUrl(value) {
    if (!isHttpUrl(value))
        return false;
    try {
        const path = decodeURIComponent(new URL(value ?? "").pathname).toLowerCase();
        return VIDEO_EXTENSIONS.some((extension) => path.endsWith(extension));
    }
    catch {
        return false;
    }
}
function unwrapWjxVideoPlayerUrl(value) {
    if (!value)
        return undefined;
    try {
        const parsed = new URL(value, "https://www.wjx.cn");
        if (parsed.pathname.toLowerCase() !== "/wjx/join/wjxvideo.html")
            return undefined;
        const type = parsed.searchParams.get("type")?.toLowerCase();
        if (type !== "true" && type !== "1")
            return undefined;
        const media = parsed.searchParams.get("url") ?? undefined;
        return isDirectVideoUrl(media) ? media : undefined;
    }
    catch {
        return undefined;
    }
}
function validateSpecialQuestionConfig(alias, body, diagnostics) {
    const type = (topLevelAttribute(body, "Type") ?? "").trim().toLowerCase();
    const verify = (topLevelAttribute(body, "Verify") ?? "").trim();
    const normalizedAlias = alias.toLowerCase();
    const imagePk = ["image_pk", "picture_pk", "pkmode"].includes(normalizedAlias)
        || (type === "matrix" && verify.toLowerCase() === "maxdiff" && topLevelAttribute(body, "MaxDiffTaskCount") === "2");
    if (imagePk) {
        const explicitTitles = (topLevelAttribute(body, "MaxDiffAttr") ?? "").replace(/\\n/g, "\n").split(/\r?\n/).filter(Boolean);
        const explicitSources = (topLevelAttribute(body, "MaxDiffSrc") ?? "").split(",").filter(Boolean);
        const itemTitles = allAttributeValues(body, "ItemTitle").filter(Boolean);
        const itemSources = allAttributeValues(body, "ItemImg").concat(allAttributeValues(body, "Src")).filter(Boolean);
        const titleCount = explicitTitles.length || itemTitles.length;
        const sourceValues = explicitSources.length ? explicitSources.map((item) => {
            try {
                return decodeURIComponent(item);
            }
            catch {
                return "";
            }
        }) : itemSources;
        if (titleCount < 3 || sourceValues.length !== titleCount || sourceValues.some((item) => !isHttpUrl(item))) {
            diagnostics.push(diagnostic("DSL_IMAGE_PK_CONFIG", "图片 PK 至少需要 3 个对象，且每个对象必须有 HTTP(S) 图片地址。"));
        }
    }
    if (normalizedAlias === "video" || (type === "matrix" && verify.toLowerCase() === "video")) {
        const videoUrl = topLevelAttribute(body, "VideoUrl");
        const valid = isDirectVideoUrl(videoUrl) || Boolean(unwrapWjxVideoPlayerUrl(videoUrl));
        if (!valid) {
            diagnostics.push(diagnostic("DSL_VIDEO_CONFIG", "视频题必须提供带视频扩展名的 HTTP(S) 媒体 URL 或问卷星 WjxVideo 播放器地址；直接媒体 URL 会由服务端自动包装。"));
        }
    }
    const psych = ["psych", "psych_embed", "experiment_embed"].includes(normalizedAlias)
        || topLevelAttribute(body, "IsPsych") === "1";
    if (psych && !isHttpUrl(topLevelAttribute(body, "PsychLink"))) {
        diagnostics.push(diagnostic("DSL_PSYCH_CONFIG", "实验嵌入必须显式提供可访问的 HTTP(S) PsychLink。"));
    }
    const vlookup = normalizedAlias === "vlookup"
        || verify.toLowerCase() === "vlookup"
        || verify.toLowerCase().startsWith("vlookup┋");
    if (vlookup) {
        const hasFriendlyConfig = Boolean(topLevelAttribute(body, "VlookupActivityId")
            && topLevelAttribute(body, "VlookupQueryQuestionIndex")
            && topLevelAttribute(body, "VlookupRefQuestionIndex"));
        const payload = verify.includes("┋") ? verify.slice(verify.indexOf("┋") + 1) : "";
        let hasPayload = false;
        if (payload) {
            try {
                const decoded = Buffer.from(payload, "base64").toString("utf8");
                hasPayload = decoded.includes('"ActivityId"')
                    && decoded.includes('"QueryQuestionIndex"')
                    && decoded.includes('"RefQuestionIndex"');
            }
            catch {
                hasPayload = false;
            }
        }
        if (!hasFriendlyConfig && !hasPayload) {
            diagnostics.push(diagnostic("DSL_VLOOKUP_CONFIG", "VLookUp 必须提供关联问卷、查询字段和回填字段，不能只写 Verify=\"vlookup\"。"));
        }
    }
}
function validateQuestionnaireSettings(value, diagnostics) {
    const masked = maskDslComments(value);
    const match = /\bquestionnaire\s*\{/i.exec(masked);
    if (!match)
        return;
    const open = masked.indexOf("{", match.index);
    const close = matchingBrace(masked, open);
    if (open < 0 || close < 0)
        return;
    const body = value.slice(open + 1, close);
    const flag = topLevelAttribute(body, "IsInformed");
    const title = topLevelAttribute(body, "InformedTitle");
    const description = topLevelAttribute(body, "InformedDesc");
    const enabled = flag === undefined ? Boolean(title || description) : /^(?:true|1)$/i.test(flag);
    if (flag !== undefined && !/^(?:true|false|1|0)$/i.test(flag)) {
        diagnostics.push(diagnostic("DSL_INFORMED_CONFIG", "IsInformed 只允许 true/false/1/0。"));
    }
    if (enabled && (!title || title.length > 100 || !description || description.length > 20000)) {
        diagnostics.push(diagnostic("DSL_INFORMED_CONFIG", "考试须知/知情同意书必须提供 InformedTitle（1..100 字符）和 InformedDesc（1..20000 字符）。"));
    }
    const questionPattern = /\bquestion\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{|\bnode\s+"Question"\s*\{/gi;
    const maskedBody = maskDslComments(body);
    const hiddenTopics = new Set();
    let vlookupCount = 0;
    let expectedHiddenCount;
    let questionMatch;
    while ((questionMatch = questionPattern.exec(maskedBody)) !== null) {
        const questionOpen = maskedBody.indexOf("{", questionMatch.index);
        const questionClose = matchingBrace(maskedBody, questionOpen);
        if (questionOpen < 0 || questionClose < 0)
            continue;
        const questionBody = body.slice(questionOpen + 1, questionClose);
        const topic = topLevelAttribute(questionBody, "Topic") ?? "";
        const topicNumber = Number(topic);
        if (Number.isInteger(topicNumber) && topicNumber > 70000 && topicNumber < 80000)
            hiddenTopics.add(topic);
        const questionAlias = (questionMatch[1] ?? "").toLowerCase();
        const questionVerify = (topLevelAttribute(questionBody, "Verify") ?? "").toLowerCase();
        if (questionAlias === "vlookup" || questionVerify === "vlookup" || questionVerify.startsWith("vlookup┋")) {
            vlookupCount += 1;
            if (questionAlias === "vlookup") {
                expectedHiddenCount = (topLevelAttribute(questionBody, "VlookupRefQuestionIndex") ?? "")
                    .split(/[,|\r\n]+/)
                    .map((item) => item.trim())
                    .filter(Boolean).length;
            }
        }
        questionPattern.lastIndex = questionClose + 1;
    }
    if (vlookupCount > 0 && vlookupCount !== 1) {
        diagnostics.push(diagnostic("DSL_VLOOKUP_CONFIG", "一份问卷只能创建一个 VLookUp 关联题。"));
    }
    if (vlookupCount > 0 && hiddenTopics.size === 0) {
        diagnostics.push(diagnostic("DSL_VLOOKUP_CONFIG", "VLookUp 必须包含 Topic=70001..79999 的隐藏回填题。"));
    }
    if (expectedHiddenCount !== undefined && hiddenTopics.size !== expectedHiddenCount) {
        diagnostics.push(diagnostic("DSL_VLOOKUP_CONFIG", "VLookUp 隐藏回填题数量必须与 VlookupRefQuestionIndex 字段数量一致。"));
    }
}
function validateQuestionSemantics(value, diagnostics) {
    const masked = maskDslComments(value);
    const pattern = /\bquestion\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{|\bnode\s+"Question"\s*\{/gi;
    let match;
    while ((match = pattern.exec(masked)) !== null) {
        const open = masked.indexOf("{", match.index);
        const close = matchingBrace(masked, open);
        if (open < 0 || close < 0)
            continue;
        const body = value.slice(open + 1, close);
        const alias = match[1] ?? "";
        const normalized = normalizedQuestionType(alias || (topLevelAttribute(body, "Type") ?? ""), body);
        const type = normalized.type;
        const items = countTopLevelBlocks(body, ["item"]);
        const rows = countTopLevelBlocks(body, ["row", "itemrow"]);
        const columns = countTopLevelBlocks(body, ["column", "itemcolumn"]);
        const referTopic = Number(topLevelAttribute(body, "ReferTopic"));
        const reference = Number.isInteger(referTopic) && referTopic > 0;
        validateSpecialQuestionConfig(alias, body, diagnostics);
        validateLevelDataShape(body, diagnostics);
        if (["radio", "radio_down", "check"].includes(type) && items === 0 && !reference && !normalized.allowEmptyItems && !normalized.skipShape)
            diagnostics.push(diagnostic("DSL_QUESTION_SHAPE", `题型 ${type} 至少需要一个 Item。`));
        if (type === "gapfill") {
            const count = Number(topLevelAttribute(body, "GapCount"));
            const titleCount = (topLevelAttribute(body, "Title")?.match(/___/g) ?? []).length;
            if (!Number.isSafeInteger(count) || count <= 0)
                diagnostics.push(diagnostic("DSL_GAP_COUNT", "gapfill 的 GapCount 必须存在且为正整数。"));
            else if (rows > 0 && rows !== count)
                diagnostics.push(diagnostic("DSL_QUESTION_SHAPE", "gapfill 的 ItemRow 数量必须与 GapCount 一致。"));
            else if (rows > 0 && titleCount === 0)
                diagnostics.push(diagnostic("DSL_QUESTION_SHAPE", "gapfill 标题必须使用 ___ 空位标记。"));
            else if (rows === 0 && titleCount !== count)
                diagnostics.push(diagnostic("DSL_QUESTION_SHAPE", "gapfill 标题中的 ___ 数量必须与 GapCount 一致。"));
        }
        if (type === "matrix" && !normalized.skipShape) {
            const mode = normalized.mode ?? Number(topLevelAttribute(body, "Mode"));
            if ([301, 302, 303].includes(mode) && columns === 0)
                diagnostics.push(diagnostic("DSL_MATRIX_SHAPE", `matrix Mode=${mode} 至少需要一个 ItemColumn。`));
            if ([201, 202, 203, 204, 301, 302, 303].includes(mode) && rows === 0 && !reference)
                diagnostics.push(diagnostic("DSL_MATRIX_SHAPE", `matrix Mode=${mode} 至少需要一个 ItemRow。`));
            if ([101, 102, 103, 2, 3, 6, 7, 303].includes(mode) && items === 0)
                diagnostics.push(diagnostic("DSL_MATRIX_SHAPE", `matrix Mode=${mode} 至少需要一个 Item。`));
            if (mode === 301) {
                const min = Number(topLevelAttribute(body, "MinValue"));
                const max = Number(topLevelAttribute(body, "MaxValue"));
                if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 0 || min >= max)
                    diagnostics.push(diagnostic("DSL_MATRIX_RANGE", "表格数值必须显式满足 0 <= MinValue < MaxValue。"));
            }
            const verify = (topLevelAttribute(body, "Verify") ?? "").trim().toLowerCase();
            if (mode === 302 && verify === "conjoint") {
                const taskCount = Number(topLevelAttribute(body, "ConjointTaskCount"));
                const taskLength = Number(topLevelAttribute(body, "ConjointTaskLength"));
                if (!Number.isSafeInteger(taskCount) || taskCount <= 0)
                    diagnostics.push(diagnostic("DSL_CONJOINT_TASK", "联合分析必须设置正整数 ConjointTaskCount。"));
                if (!Number.isSafeInteger(taskLength) || taskLength <= 0)
                    diagnostics.push(diagnostic("DSL_CONJOINT_TASK", "联合分析必须设置正整数 ConjointTaskLength。"));
                if (columns < 3)
                    diagnostics.push(diagnostic("DSL_CONJOINT_SHAPE", "联合分析至少需要两个属性列和一个是否选中列。"));
            }
        }
    }
}
/** Lightweight protocol checks. Semantic validation remains authoritative on the server. */
export function validateWjxDsl(value, options = {}) {
    if (typeof value !== "string")
        return [diagnostic("DSL_TYPE", "dsl 必须是字符串")];
    const maxBytes = options.maxBytes ?? MAX_WJX_DSL_BYTES;
    const bytes = Buffer.byteLength(value, "utf8");
    if (bytes === 0 || value.trim().length === 0)
        return [diagnostic("DSL_EMPTY", "dsl 不能为空")];
    if (bytes > maxBytes)
        return [diagnostic("DSL_TOO_LARGE", `dsl 超过 ${maxBytes} 字节限制`)];
    const diagnostics = [];
    const first = value.replace(/^\uFEFF/, "").trimStart();
    if (!/^wjx-dsl\s+1\s*;/i.test(first))
        diagnostics.push(diagnostic("DSL_HEADER", "DSL 必须以 wjx-dsl 1; 开头"));
    if (!/\bquestionnaire\s*\{/i.test(first))
        diagnostics.push(diagnostic("DSL_ROOT", "DSL 缺少 questionnaire 根节点"));
    let depth = 0;
    let quote = false;
    let escaped = false;
    const lines = value.split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        for (const char of lines[lineIndex]) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === "\\" && quote) {
                escaped = true;
                continue;
            }
            if (char === '"') {
                quote = !quote;
                continue;
            }
            if (quote)
                continue;
            if (char === "{")
                depth += 1;
            if (char === "}")
                depth -= 1;
            if (depth < 0) {
                diagnostics.push(diagnostic("DSL_BRACES", "DSL 包含多余的右花括号", lineIndex + 1));
                depth = 0;
            }
        }
    }
    if (quote)
        diagnostics.push(diagnostic("DSL_STRING", "DSL 包含未闭合字符串"));
    if (depth !== 0)
        diagnostics.push(diagnostic("DSL_BRACES", "DSL 花括号未配对"));
    validateFileUploadMaxSizes(value, diagnostics);
    validateDuplicateTopics(value, diagnostics);
    validateQuestionSemantics(value, diagnostics);
    validateQuestionnaireSettings(value, diagnostics);
    return diagnostics.slice(0, options.maxDiagnostics ?? 100);
}
export function normalizeWjxDsl(value) {
    // The legacy editor's gap-fill parser recognizes three underscores. Accept
    // the author-friendly `{_}` spelling and normalize it before transport.
    return value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/\{_\}/g, "___");
}
export function generateWjxDsl(value, options) {
    const dsl = normalizeWjxDsl(value);
    const diagnostics = validateWjxDsl(dsl, options);
    return { dsl, diagnostics, valid: diagnostics.every((item) => item.severity !== "Error"), byteLength: Buffer.byteLength(dsl, "utf8") };
}
//# sourceMappingURL=validate.js.map