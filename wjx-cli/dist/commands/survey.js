import { readFileSync } from "node:fs";
import { createSurvey, createSurveyByText, createSurveyByJson, getSurvey, listSurveys, updateSurveyStatus, getSurveySettings, updateSurveySettings, deleteSurvey, getQuestionTags, getTagDetails, clearRecycleBin, uploadFile, buildSurveyUrl, surveyToText, textToSurvey, parsedQuestionsToWire, MAX_JSONL_SIZE, } from "wjx-api-sdk";
import { formatOutput } from "../lib/output.js";
import { CliError, handleError } from "../lib/errors.js";
import { getCredentials } from "../lib/auth.js";
import { executeCommand, strictInt, requireField, getMerged, createCapturingFetch, printDryRunPreview, ensureJsonString, ensureStringArray } from "../lib/command-helpers.js";
export function registerSurveyCommands(program) {
    const survey = program.command("survey").description("问卷管理");
    // --- list ---
    survey
        .command("list")
        .description("列出问卷")
        .option("--page <n>", "页码", strictInt)
        .option("--page_size <n>", "每页数量", strictInt)
        .option("--status <n>", "状态筛选", strictInt)
        .option("--atype <n>", "问卷类型筛选：1=调查, 2=测评, 3=投票, 4=360度评估, 5=360评估无测评关系, 6=考试, 7=表单, 8=用户体系, 9=教学评估, 10=量表, 11=民主评议", strictInt)
        .option("--name_like <s>", "名称搜索")
        .option("--sort <n>", "排序规则：0=ID升序, 1=ID降序, 2=开始时间升序, 3=开始时间降序, 4=创建时间升序, 5=创建时间降序", strictInt)
        .option("--creater <s>", "创建者（子账号用户名）")
        .option("--folder <s>", "文件夹名称筛选")
        .option("--is_xingbiao", "仅显示星标问卷")
        .option("--query_all", "查询所有问卷（含子账号）")
        .option("--verify_status <n>", "审核状态筛选", strictInt)
        .option("--time_type <n>", "时间类型：0=创建时间, 1=最后修改时间", strictInt)
        .option("--begin_time <n>", "起始时间（毫秒时间戳）", strictInt)
        .option("--end_time <n>", "结束时间（毫秒时间戳）", strictInt)
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, listSurveys, (m) => ({
            page_index: m.page,
            page_size: m.page_size,
            status: m.status,
            atype: m.atype,
            name_like: m.name_like,
            sort: m.sort,
            creater: m.creater,
            folder: m.folder,
            is_xingbiao: m.is_xingbiao,
            query_all: m.query_all,
            verify_status: m.verify_status,
            time_type: m.time_type,
            begin_time: m.begin_time,
            end_time: m.end_time,
        }));
    });
    // --- get ---
    survey
        .command("get")
        .description("获取问卷详情")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--get_questions", "返回题目信息")
        .option("--get_items", "返回选项信息")
        .option("--get_exts", "返回扩展信息")
        .option("--get_setting", "返回设置信息")
        .option("--get_page_cut", "返回分页信息")
        .option("--get_tags", "返回标签信息")
        .option("--showtitle", "显示标题")
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, getSurvey, (m) => {
            requireField(m, "vid");
            return {
                vid: m.vid,
                get_questions: m.get_questions,
                get_items: m.get_items,
                get_exts: m.get_exts,
                get_setting: m.get_setting,
                get_page_cut: m.get_page_cut,
                get_tags: m.get_tags,
                showtitle: m.showtitle,
            };
        });
    });
    // --- create ---
    survey
        .command("create")
        .description("创建问卷")
        .option("--title <s>", "问卷标题")
        .option("--type <n>", "问卷类型", strictInt)
        .option("--description <s>", "问卷描述")
        .option("--questions <json>", "题目JSON数组")
        .option("--optional_titles <json>", "允许设为选填的题目标题 JSON 数组")
        .option("--source_vid <s>", "复制源问卷ID")
        .option("--publish", "创建后发布")
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, createSurvey, (m) => {
            requireField(m, "title");
            return {
                title: m.title,
                type: m.type ?? 0,
                description: m.description ?? "",
                questions: ensureJsonString(m.questions, "questions") ?? "[]",
                optionalTitles: ensureStringArray(m.optional_titles, "optional_titles"),
                source_vid: m.source_vid,
                publish: m.publish,
            };
        });
    });
    // --- create-by-text ---
    survey
        .command("create-by-text")
        .description("⚠️ 已弃用：用 DSL 文本创建问卷，仅作向后兼容保留。请使用 create-by-json（支持 70+ 题型，无 DSL 转义陷阱）")
        .option("--text <s>", "DSL 格式问卷文本")
        .option("--file <path>", "从文件读取 DSL 文本")
        .option("--type <n>", "问卷类型：1=调查, 2=测评, 3=投票, 6=考试, 7=表单, 10=量表, 11=民主测评", strictInt)
        .option("--publish", "创建后发布")
        .option("--creater <s>", "创建者子账号")
        .action(async (_opts, cmd) => {
        try {
            const merged = getMerged(cmd);
            const globalOpts = program.opts();
            // Resolve DSL text: --text > --file > stdin.text
            let dslText;
            if (typeof merged.text === "string" && merged.text) {
                dslText = merged.text;
            }
            else if (typeof merged.file === "string" && merged.file) {
                try {
                    dslText = readFileSync(merged.file, "utf8");
                }
                catch {
                    throw new CliError("INPUT_ERROR", `无法读取文件: ${merged.file}`);
                }
            }
            if (!dslText) {
                throw new CliError("INPUT_ERROR", "必须提供 --text 或 --file 参数");
            }
            if (globalOpts.dryRun) {
                const parsed = textToSurvey(dslText);
                const { questions: wireQuestions, skippedParagraphs } = parsedQuestionsToWire(parsed.questions);
                process.stderr.write(JSON.stringify({
                    dry_run: true,
                    parsed_title: parsed.title,
                    parsed_description: parsed.description,
                    question_count: wireQuestions.length,
                    skipped_paragraphs: skippedParagraphs.length > 0
                        ? skippedParagraphs.map((q) => q.title)
                        : undefined,
                    wire_questions: wireQuestions,
                }, null, 2) + "\n");
                return;
            }
            const creds = getCredentials(globalOpts);
            // 弃用警告：在所有输入校验和 dry-run 之后、真实请求之前打印
            // 这样测试解析 stderr 失败/dry-run JSON 时不会被警告污染
            process.stderr.write("[wjx] ⚠️ create-by-text 已弃用，建议改用 create-by-json：\n" +
                "      wjx survey create-by-json --file <path>.jsonl\n" +
                "      JSON 路径覆盖 70+ 题型，无 DSL 转义陷阱（PowerShell $ 变量、行内逗号等）。\n" +
                "      除非你明确需要 DSL 兼容，否则请改用 create-by-json。\n");
            const result = await createSurveyByText({
                text: dslText,
                atype: merged.type,
                publish: merged.publish,
                creater: merged.creater,
            }, creds);
            if (result.result === false) {
                throw new CliError("API_ERROR", result.errormsg || "API request failed");
            }
            formatOutput(result, globalOpts);
        }
        catch (e) {
            handleError(e);
        }
    });
    // --- create-by-json ---
    survey
        .command("create-by-json")
        .description("用 JSONL 格式创建问卷（支持 70+ 题型，推荐 AI Agent 使用）")
        .option("--jsonl <s>", "JSONL 格式问卷文本")
        .option("--file <path>", "从文件读取 JSONL 文本")
        .option("--title <s>", "覆盖 JSONL 中的问卷标题")
        .option("--type <n>", "问卷类型：1=调查, 2=测评, 3=投票, 6=考试, 7=表单, 10=量表, 11=民主测评", strictInt)
        .option("--optional_titles <json>", "允许设为选填的题目标题 JSON 数组")
        .option("--publish", "创建后发布")
        .option("--creater <s>", "创建者子账号")
        .action(async (_opts, cmd) => {
        try {
            const merged = getMerged(cmd);
            // Resolve JSONL text: --jsonl > --file > stdin.jsonl
            let jsonlText;
            if (typeof merged.jsonl === "string" && merged.jsonl) {
                jsonlText = merged.jsonl;
            }
            else if (typeof merged.file === "string" && merged.file) {
                try {
                    const raw = readFileSync(merged.file, "utf8");
                    if (raw.length > MAX_JSONL_SIZE) {
                        throw new CliError("INPUT_ERROR", `文件大小 ${raw.length} 字节超过上限 ${MAX_JSONL_SIZE}`);
                    }
                    jsonlText = raw;
                }
                catch (e) {
                    if (e instanceof CliError)
                        throw e;
                    throw new CliError("INPUT_ERROR", `无法读取文件: ${merged.file}`);
                }
            }
            if (!jsonlText) {
                throw new CliError("INPUT_ERROR", "必须提供 --jsonl 或 --file 参数");
            }
            const globalOpts = program.opts();
            const creds = getCredentials(globalOpts);
            if (globalOpts.dryRun) {
                const { fetchImpl, getCapturedRequest } = createCapturingFetch();
                await createSurveyByJson({
                    jsonl: jsonlText,
                    title: merged.title,
                    atype: merged.type,
                    optionalTitles: ensureStringArray(merged.optional_titles, "optional_titles"),
                    publish: merged.publish,
                    creater: merged.creater,
                }, creds, fetchImpl);
                printDryRunPreview(getCapturedRequest());
                return;
            }
            const result = await createSurveyByJson({
                jsonl: jsonlText,
                title: merged.title,
                atype: merged.type,
                optionalTitles: ensureStringArray(merged.optional_titles, "optional_titles"),
                publish: merged.publish,
                creater: merged.creater,
            }, creds);
            if (result.result === false) {
                throw new CliError("API_ERROR", result.errormsg || "API request failed");
            }
            formatOutput(result, globalOpts);
        }
        catch (e) {
            handleError(e);
        }
    });
    // --- delete ---
    survey
        .command("delete")
        .description("删除问卷")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--username <s>", "用户名")
        .option("--completely", "彻底删除")
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, deleteSurvey, (m) => {
            requireField(m, "vid");
            requireField(m, "username");
            return {
                vid: m.vid,
                username: m.username,
                completely_delete: m.completely,
            };
        });
    });
    // --- status ---
    survey
        .command("status")
        .description("更新问卷状态（1=发布, 2=暂停, 3=删除）")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--state <n>", "目标状态", strictInt)
        .option("--status <n>", "目标状态（--state 的别名，兼容直觉命名）", strictInt)
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, updateSurveyStatus, (m) => {
            requireField(m, "vid");
            // 接受 --state 或 --status，任一即可
            const state = m.state ?? m.status;
            if (state === undefined || state === null) {
                throw new CliError("INPUT_ERROR", "Missing required option: --state（或 --status）");
            }
            return { vid: m.vid, state };
        });
    });
    // --- settings ---
    survey
        .command("settings")
        .description("获取问卷设置")
        .option("--vid <n>", "问卷ID", strictInt)
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, getSurveySettings, (m) => {
            requireField(m, "vid");
            return { vid: m.vid };
        });
    });
    // --- update-settings ---
    survey
        .command("update-settings")
        .description("更新问卷设置")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--api_setting <json>", "API设置JSON")
        .option("--after_submit_setting <json>", "提交后设置JSON")
        .option("--msg_setting <json>", "消息设置JSON")
        .option("--sojumpparm_setting <json>", "参数设置JSON")
        .option("--time_setting <json>", "时间设置JSON")
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, updateSurveySettings, (m) => {
            requireField(m, "vid");
            return {
                vid: m.vid,
                api_setting: ensureJsonString(m.api_setting, "api_setting"),
                after_submit_setting: ensureJsonString(m.after_submit_setting, "after_submit_setting"),
                msg_setting: ensureJsonString(m.msg_setting, "msg_setting"),
                sojumpparm_setting: ensureJsonString(m.sojumpparm_setting, "sojumpparm_setting"),
                time_setting: ensureJsonString(m.time_setting, "time_setting"),
            };
        });
    });
    // --- tags ---
    survey
        .command("tags")
        .description("获取题目标签")
        .option("--username <s>", "用户名")
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, getQuestionTags, (m) => {
            requireField(m, "username");
            return { username: m.username };
        });
    });
    // --- tag-details ---
    survey
        .command("tag-details")
        .description("获取标签详情")
        .option("--tag_id <n>", "标签ID", strictInt)
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, getTagDetails, (m) => {
            requireField(m, "tag_id", "tag_id");
            return { tag_id: m.tag_id };
        });
    });
    // --- clear-bin ---
    survey
        .command("clear-bin")
        .description("清空回收站")
        .option("--username <s>", "用户名")
        .option("--vid <n>", "指定问卷ID", strictInt)
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, clearRecycleBin, (m) => {
            requireField(m, "username");
            return { username: m.username, vid: m.vid };
        });
    });
    // --- upload ---
    survey
        .command("upload")
        .description("上传文件")
        .option("--file_name <s>", "文件名")
        .option("--file <s>", "文件Base64内容")
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, uploadFile, (m) => {
            requireField(m, "file_name");
            requireField(m, "file");
            return { file_name: m.file_name, file: m.file };
        });
    });
    // --- export-text ---
    survey
        .command("export-text")
        .description("导出问卷为纯文本（题目+选项）")
        .option("--vid <n>", "问卷ID", strictInt)
        .option("--raw", "输出纯文本（不包裹 JSON）")
        .action(async (_opts, cmd) => {
        try {
            const merged = getMerged(cmd);
            requireField(merged, "vid");
            const creds = getCredentials(program.opts());
            if (program.opts().dryRun) {
                const { fetchImpl, getCapturedRequest } = createCapturingFetch();
                await getSurvey({ vid: merged.vid }, creds, fetchImpl);
                printDryRunPreview(getCapturedRequest());
                return;
            }
            const result = await getSurvey({ vid: merged.vid }, creds);
            if (result.result === false) {
                throw new CliError("API_ERROR", result.errormsg || "API request failed");
            }
            const data = result.data;
            if (!data) {
                throw new CliError("API_ERROR", "API 返回数据为空");
            }
            const text = surveyToText(data);
            const globalOpts = program.opts();
            if (merged.raw || globalOpts.table) {
                console.log(text);
            }
            else {
                console.log(JSON.stringify({ vid: merged.vid, text }, null, 2));
            }
        }
        catch (e) {
            handleError(e);
        }
    });
    // --- jsonl-template ---
    survey
        .command("jsonl-template")
        .description("输出 create-by-json 可直接使用的 JSONL 骨架（按 --type 切换调查/投票/考试/表单等）")
        .option("--type <n>", "问卷类型：1=调查（默认）, 2=测评, 3=投票, 6=考试, 7=表单, 10=量表", strictInt)
        .option("--raw", "直接输出 JSONL 文本（不包裹 JSON），便于重定向到文件")
        .action(async (_opts, cmd) => {
        try {
            const merged = getMerged(cmd);
            const atype = merged.type ?? 1;
            const jsonl = buildJsonlTemplate(atype);
            const globalOpts = program.opts();
            if (merged.raw || globalOpts.table) {
                process.stdout.write(jsonl);
                if (!jsonl.endsWith("\n"))
                    process.stdout.write("\n");
            }
            else {
                console.log(JSON.stringify({ atype, template: jsonl }, null, 2));
            }
        }
        catch (e) {
            handleError(e);
        }
    });
    // --- url ---
    survey
        .command("url")
        .description("生成问卷 URL（创建/编辑）")
        .option("--mode <s>", "模式: create 或 edit")
        .option("--name <s>", "问卷名称（create模式）")
        .option("--activity <n>", "问卷vid（edit模式必填）", strictInt)
        .action(async (_opts, cmd) => {
        try {
            const merged = getMerged(cmd);
            const mode = merged.mode ?? "create";
            const validModes = ["create", "edit"];
            if (!validModes.includes(mode)) {
                throw new CliError("INPUT_ERROR", `无效的 mode: "${mode}"，可选值: ${validModes.join(", ")}`);
            }
            const url = buildSurveyUrl({
                mode: mode,
                name: merged.name,
                activity: merged.activity,
            });
            const globalOpts = program.opts();
            if (globalOpts.table) {
                console.log(url);
            }
            else {
                console.log(JSON.stringify({ url }, null, 2));
            }
        }
        catch (e) {
            handleError(e);
        }
    });
}
const TEMPLATE_QUESTIONS_BY_ATYPE = {
    1: [
        { qtype: "单选", title: "您的性别", select: ["男", "女"] },
        { qtype: "多选", title: "您平时喜欢的运动（多选）", select: ["跑步", "游泳", "球类", "瑜伽"] },
        { qtype: "量表题", title: "您对当前服务的满意度（1=非常不满意, 5=非常满意）", select: ["1", "2", "3", "4", "5"] },
        { qtype: "矩阵单选", title: "请评价以下方面", rowtitle: ["响应速度", "服务态度", "问题解决"], select: ["差", "一般", "好", "很好"] },
        { qtype: "简答题", title: "您还有什么建议？" },
    ],
    2: [
        { qtype: "单选", title: "请选择最贴近您的描述", select: ["A 选项", "B 选项", "C 选项"] },
        { qtype: "量表题", title: "您对此观点的认同程度（1=完全不认同, 5=完全认同）", select: ["1", "2", "3", "4", "5"] },
        { qtype: "矩阵单选", title: "请按以下维度评估", rowtitle: ["维度一", "维度二", "维度三"], select: ["低", "中", "高"] },
    ],
    3: [
        { qtype: "投票单选", title: "请选出您最喜欢的候选项（单选）", select: ["候选 A", "候选 B", "候选 C"] },
        { qtype: "投票多选", title: "请选出您支持的候选项（最多 2 项）", select: ["候选 A", "候选 B", "候选 C", "候选 D"] },
    ],
    6: [
        { qtype: "考试单选", title: "下列说法正确的是？", select: ["A. 错误说法", "B. 正确说法", "C. 错误说法"], correctselect: ["B"], quizscore: "10" },
        { qtype: "考试多选", title: "请选出所有正确选项", select: ["A. 正确", "B. 错误", "C. 正确", "D. 错误"], correctselect: ["A", "C"], quizscore: "10" },
        { qtype: "考试判断", title: "1+1=2", select: ["对", "错"], correctselect: ["对"], quizscore: "5" },
        { qtype: "考试简答", title: "请简述你的看法", quizscore: "20" },
    ],
    7: [
        { qtype: "单项填空", title: "您的姓名" },
        { qtype: "邮箱", title: "您的邮箱" },
        { qtype: "手机", title: "您的手机号" },
        { qtype: "单选", title: "请选择您的部门", select: ["研发", "产品", "运营", "其他"] },
    ],
    10: [
        { qtype: "矩阵量表", title: "请按以下维度打分（1-7 分）", rowtitle: ["条目 1", "条目 2", "条目 3"], select: ["1", "2", "3", "4", "5", "6", "7"] },
        { qtype: "量表题", title: "总体感受（1-7 分）", select: ["1", "2", "3", "4", "5", "6", "7"] },
    ],
};
const TEMPLATE_TITLE_BY_ATYPE = {
    1: "示例调查问卷（请改成你的标题）",
    2: "示例测评（请改成你的标题）",
    3: "示例投票（请改成你的标题）",
    6: "示例考试（请改成你的标题）",
    7: "示例表单（请改成你的标题）",
    10: "示例量表（请改成你的标题）",
};
function buildJsonlTemplate(atype) {
    const validAtypes = new Set([1, 2, 3, 6, 7, 10]);
    if (!validAtypes.has(atype)) {
        throw new CliError("INPUT_ERROR", `无效的 --type "${atype}"，可选值：1=调查, 2=测评, 3=投票, 6=考试, 7=表单, 10=量表`);
    }
    const meta = {
        qtype: "问卷基础信息",
        title: TEMPLATE_TITLE_BY_ATYPE[atype],
        atype,
    };
    const questions = TEMPLATE_QUESTIONS_BY_ATYPE[atype] ?? [];
    return [meta, ...questions].map((q) => JSON.stringify(q)).join("\n") + "\n";
}
//# sourceMappingURL=survey.js.map