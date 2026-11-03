import { getSurvey } from "./client.js";
import { jsonToSurvey, NON_QUESTION_QTYPE_SET, parseJsonl } from "./json-to-survey.js";
import { compareJsonlQuestionTypes, extractJsonlQuestionTypeExpectations, filterJsonlVerificationQuestions, getJsonlQuestionTypeCode } from "./qtype-mapping.js";
import { surveyLogicMatches, surveyLogicPreservesQuestionContent, surveyLogicReadOptions } from "./logic.js";
function matchesItemTitles(expected, actual) {
    return Array.isArray(expected) && expected.length > 0 && Array.isArray(actual) && actual.length === expected.length
        && expected.every((title, index) => typeof title === "string" && actual[index]?.item_title === title);
}
/** Compare only documented read-back fields; unsupported shapes remain unverified. */
function compareJsonContent(input, data) {
    const warnings = [];
    const rows = parseJsonl(input.jsonl);
    const expected = rows.filter(row => !NON_QUESTION_QTYPE_SET.has(row.qtype));
    const actual = filterJsonlVerificationQuestions(data.questions);
    const allowed = new Set(["qtype", "title", "select", "requir"]);
    if (expected.length !== actual.length)
        warnings.push("修改后的题目数量无法与 JSONL 内容逐一对应");
    for (let index = 0; index < expected.length; index++) {
        const row = expected[index], saved = actual[index];
        const label = `第 ${index + 1} 道题`;
        if (!saved || saved.q_title !== row.title)
            warnings.push(`${label}题干与 JSONL 请求不一致或未返回`);
        if (!saved || saved.is_requir !== (row.requir ?? true))
            warnings.push(`${label}必答设置与 JSONL 请求不一致或未返回`);
        const type = getJsonlQuestionTypeCode(row.qtype);
        const matrix = type?.q_type === 7 && [701, 702, 703, 704].includes(type.q_subtype);
        if (!matrix && (!type || ![3, 4, 5, 8, 10].includes(type.q_type))) {
            warnings.push(`${label}题型「${row.qtype}」的完整内容暂不能通过查询结果确认`);
        }
        // ExtQMatrix exposes the left-hand labels separately from selectable items.
        // Table columns have a different JSONL contract and remain unverified here.
        if (matrix && !matchesItemTitles(row.rowtitle, saved?.item_rows)) {
            warnings.push(`${label}矩阵行标题内容或顺序与 JSONL 请求不一致或未返回`);
        }
        if (row.select !== undefined) {
            if (!matchesItemTitles(row.select, saved?.items)) {
                warnings.push(`${label}选项内容或顺序与 JSONL 请求不一致或未返回`);
            }
        }
        else if ((type && [3, 4].includes(type.q_type)) || (matrix && type.q_subtype !== 704)) {
            warnings.push(`${label}未提供可核对的完整选项内容`);
        }
        const unsupported = Object.keys(row).filter(key => !allowed.has(key) && !(matrix && key === "rowtitle"));
        if (unsupported.length)
            warnings.push(`${label}字段尚不能完整读回校验：${unsupported.join("、")}`);
    }
    const metadata = rows.find(row => row.qtype === "问卷基础信息");
    if (metadata) {
        const expectedType = input.atype ?? metadata.atype;
        if (expectedType !== undefined && Number(data.atype) !== Number(expectedType))
            warnings.push("修改后的问卷类型与请求不一致或未返回");
        if (metadata.introduction !== undefined && data.description !== metadata.introduction)
            warnings.push("修改后的问卷说明与请求不一致或未返回");
        const unsupported = Object.keys(metadata).filter(key => !["qtype", "title", "atype", "introduction"].includes(key));
        if (unsupported.length)
            warnings.push(`问卷基础信息字段尚不能完整读回校验：${unsupported.join("、")}`);
    }
    // Empty pagination changes position, not the correspondence of real questions.
    // Other scaffolding may carry content that the ordinary query cannot confirm.
    if (rows.some(row => NON_QUESTION_QTYPE_SET.has(row.qtype) && row.qtype !== "问卷基础信息"
        && !(row.qtype === "分页栏" && Object.keys(row).every(key => key === "qtype")))) {
        warnings.push("分页或说明内容尚不能完整读回校验");
    }
    return { matches: warnings.length === 0, warnings };
}
/** 通过普通查询读取真实 XML 投影，验证 JSON 更新；不依赖提交时的 DSL 影子副本。 */
export async function verifySurveyJsonUpdate(input, before, credentials, fetchImpl) {
    const response = await getSurvey({ vid: Number(input.vid), get_questions: true, get_items: true,
        ...surveyLogicReadOptions(input.dsl?.logic) }, credentials, fetchImpl);
    const warnings = [];
    const data = response.result === true ? response.data : undefined;
    let structure = !!data && String(data.vid) === String(input.vid);
    if (structure && data) {
        if (input.jsonl !== undefined) {
            const parsed = jsonToSurvey(input.jsonl);
            structure = data.title === (input.title ?? parsed.title)
                && Array.isArray(data.questions)
                && compareJsonlQuestionTypes(extractJsonlQuestionTypeExpectations(input.jsonl), data.questions).matches;
            if (Array.isArray(data.questions)) {
                const content = compareJsonContent(input, data);
                structure = structure && content.matches;
                warnings.push(...content.warnings);
            }
        }
        else {
            structure = typeof before.title === "string" && data.title === before.title
                && Array.isArray(before.questions) && Array.isArray(data.questions)
                && surveyLogicPreservesQuestionContent(input.dsl?.logic, before.questions, data.questions);
        }
    }
    if (input.dsl && !surveyLogicMatches(input.dsl.logic, data?.dsl?.logic, Array.isArray(data?.questions) ? data.questions : undefined)) {
        structure = false;
        warnings.push("保存后的 XML 逻辑投影与请求不一致或未返回，尚未验证逻辑更新");
    }
    if (!structure)
        warnings.push("更新后问卷身份、题目内容或逻辑未通过读回校验");
    const savedStatus = typeof data?.status === "number" ? data.status
        : typeof data?.status === "string" && /^\d+$/.test(data.status) ? Number(data.status) : undefined;
    const status = savedStatus !== undefined && [0, 1, 2, 3, 4, 5].includes(savedStatus)
        && (input.publish === undefined || (input.publish ? savedStatus === 1 : [0, 2].includes(savedStatus)));
    return { verification: { structure, status, count: structure, link: true }, outcome: structure && status ? "verified" : "unknown", warnings };
}
//# sourceMappingURL=verify.js.map