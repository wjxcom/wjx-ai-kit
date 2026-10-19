const MAX_LOGIC_BYTES = 4 * 1024 * 1024;
/** 仅校验模块边界；规则语义由服务端现有 DSL 解析器校验。 */
export function prepareSurveyDslJson(value) {
    if (value === undefined)
        return undefined;
    if (!value || typeof value !== "object" || Array.isArray(value)
        || Object.keys(value).length !== 1 || !("logic" in value)
        || typeof value.logic !== "string") {
        throw new TypeError("dsl 必须是仅包含字符串 logic 的 JSON 对象");
    }
    const logic = value.logic.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
    if (Buffer.byteLength(logic, "utf8") > MAX_LOGIC_BYTES)
        throw new TypeError("dsl.logic 超过 4 MiB 上限");
    if (!/^logic\s*\{/.test(logic))
        throw new TypeError("dsl.logic 必须是 logic { ... }; 模块");
    let depth = 0, quote = false, escape = false, lineComment = false, blockComment = false;
    let end = -1;
    for (let i = logic.indexOf("{"); i < logic.length; i++) {
        const char = logic[i], next = logic[i + 1];
        if (lineComment) {
            if (char === "\n")
                lineComment = false;
            continue;
        }
        if (blockComment) {
            if (char === "*" && next === "/") {
                blockComment = false;
                i++;
            }
            continue;
        }
        if (quote) {
            if (escape)
                escape = false;
            else if (char === "\\")
                escape = true;
            else if (char === '"')
                quote = false;
            continue;
        }
        if (char === '"')
            quote = true;
        else if (char === "/" && next === "/") {
            lineComment = true;
            i++;
        }
        else if (char === "#")
            lineComment = true;
        else if (char === "/" && next === "*") {
            blockComment = true;
            i++;
        }
        else if (char === "{")
            depth++;
        else if (char === "}" && --depth === 0) {
            end = i;
            break;
        }
    }
    if (end < 0 || logic.slice(end + 1).trim() !== ";") {
        throw new TypeError("dsl.logic 必须包含一个完整的 logic { ... }; 模块，不能附带题目或完整 DSL 文档");
    }
    return { logic };
}
/** 检查请求的规则是否出现在实际 XML 投影中；其他已有规则允许保留。 */
export function surveyLogicMatches(expected, actual, questions) {
    const tokens = (text) => {
        const parts = text.match(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|[^\s]/g) ?? [];
        const rules = [];
        let current = [];
        for (const token of parts) {
            if (token.startsWith("//") || token.startsWith("/*") || token.startsWith("#"))
                continue;
            current.push(token);
            if (token === ";") {
                rules.push(current.join(""));
                current = [];
            }
        }
        return rules.sort().join("\n") + current.join("");
    };
    // 模块前缀和后缀单独去除，避免首条规则随原始顺序改变。
    const body = (text) => text.trim().replace(/^logic\s*\{/, "").replace(/\}\s*;$/, "");
    const expectedRules = tokens(body(expected)).split("\n").filter(Boolean);
    const actualRules = new Set(typeof actual === "string" ? tokens(body(actual)).split("\n").filter(Boolean) : []);
    if (typeof actual !== "string" && expectedRules.length === 0)
        return false;
    return expectedRules.every((rule) => {
        // Native XML represents unconditional show by clearing Relation, so it
        // intentionally disappears from the logic projection. Require explicit
        // evidence from the existing question instead of assuming absence is success.
        const display = /^(show|hide)("(?:\\.|[^"\\])*");$/.exec(rule);
        if (!display)
            return actualRules.has(rule);
        if (!questions)
            return false;
        let topic;
        try {
            topic = JSON.parse(display[2]);
        }
        catch {
            return false;
        }
        if (typeof topic !== "string" || !/^[1-9]\d*$/.test(topic))
            return false;
        const targets = questions.filter(question => String(question.q_index) === topic);
        if (targets.length !== 1 || !Object.hasOwn(targets[0], "relation")
            || !(Number(targets[0].q_type ?? targets[0].qType) > 2))
            return false;
        const hidden = display[1] === "hide";
        if (!(hidden ? ["-1", -1] : [""]).includes(targets[0].relation)
            || (Object.hasOwn(targets[0], "is_hide") && targets[0].is_hide !== hidden))
            return false;
        const target = JSON.stringify(topic);
        return ![...actualRules].some(saved => {
            if (hidden && (saved === rule || saved === `rawattr"Relation"question${target}="-1";`))
                return false;
            return saved.includes(`show${target}`) || saved.includes(`hide${target}`)
                || saved.startsWith(`rawattr"Relation"question${target}=`);
        });
    });
}
//# sourceMappingURL=logic.js.map