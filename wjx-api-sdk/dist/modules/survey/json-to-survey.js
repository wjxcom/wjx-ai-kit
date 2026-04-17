// ─── Types ──────────────────────────────────────────────────────────
/** createSurveyByJson 的 JSONL 大小上限（1 MB） */
export const MAX_JSONL_SIZE = 1_000_000;
// ─── JSONL 元数据提取 ──────────────────────────────────────────────
/**
 * 从 JSONL 文本中提取首行 "问卷基础信息" 的元数据（title / description 等）。
 * 仅做最小解析：找到第一个 qtype === "问卷基础信息" 的行即返回。
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
                return {
                    title: typeof obj.title === "string" ? obj.title : "",
                    description: typeof obj.introduction === "string" ? obj.introduction : "",
                    endpageinformation: typeof obj.endpageinformation === "string" ? obj.endpageinformation : "",
                    language: typeof obj.language === "string" ? obj.language : "zh",
                };
            }
        }
        catch {
            // 跳过无法解析的行，让服务端处理
        }
    }
    return { title: "", description: "", endpageinformation: "", language: "zh" };
}
/**
 * 对 JSONL 文本做标准化预处理：
 * - 剥离 BOM（Windows UTF-8 BOM）
 * - CRLF → LF
 */
export function normalizeJsonl(jsonl) {
    return jsonl.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}
//# sourceMappingURL=json-to-survey.js.map