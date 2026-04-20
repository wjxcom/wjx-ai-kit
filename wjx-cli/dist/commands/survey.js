import { readFileSync } from "node:fs";
import { createSurvey, createSurveyByText, createSurveyByJson, getSurvey, listSurveys, updateSurveyStatus, getSurveySettings, updateSurveySettings, deleteSurvey, getQuestionTags, getTagDetails, clearRecycleBin, uploadFile, buildSurveyUrl, surveyToText, textToSurvey, parsedQuestionsToWire, extractJsonlMetadata, normalizeJsonl, MAX_JSONL_SIZE, } from "wjx-api-sdk";
import { formatOutput } from "../lib/output.js";
import { CliError, handleError } from "../lib/errors.js";
import { getCredentials } from "../lib/auth.js";
import { executeCommand, strictInt, requireField, getMerged, createCapturingFetch, printDryRunPreview, ensureJsonString } from "../lib/command-helpers.js";
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
                source_vid: m.source_vid,
                publish: m.publish,
            };
        });
    });
    // --- create-by-text ---
    survey
        .command("create-by-text")
        .description("用 DSL 文本创建问卷（推荐 AI Agent 使用）")
        .option("--text <s>", "DSL 格式问卷文本")
        .option("--file <path>", "从文件读取 DSL 文本")
        .option("--type <n>", "问卷类型：1=调查, 2=测评, 3=投票, 6=考试, 7=表单", strictInt)
        .option("--publish", "创建后发布")
        .option("--creater <s>", "创建者子账号")
        .action(async (_opts, cmd) => {
        try {
            const merged = getMerged(cmd);
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
            const globalOpts = program.opts();
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
        .option("--type <n>", "问卷类型：1=调查, 2=测评, 3=投票, 6=考试, 7=表单", strictInt)
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
            const normalized = normalizeJsonl(jsonlText.trim());
            const globalOpts = program.opts();
            if (globalOpts.dryRun) {
                const metadata = extractJsonlMetadata(normalized);
                const lineCount = normalized.split("\n").filter((l) => l.trim()).length;
                process.stderr.write(JSON.stringify({
                    dry_run: true,
                    metadata,
                    line_count: lineCount,
                    jsonl_size: normalized.length,
                }, null, 2) + "\n");
                return;
            }
            const creds = getCredentials(globalOpts);
            const result = await createSurveyByJson({
                jsonl: jsonlText,
                title: merged.title,
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
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, updateSurveyStatus, (m) => {
            requireField(m, "vid");
            requireField(m, "state");
            return { vid: m.vid, state: m.state };
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
//# sourceMappingURL=survey.js.map