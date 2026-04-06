import { readFileSync } from "node:fs";
import { createSurvey, createSurveyByText, getSurvey, listSurveys, updateSurveyStatus, getSurveySettings, updateSurveySettings, deleteSurvey, getQuestionTags, getTagDetails, clearRecycleBin, uploadFile, buildSurveyUrl, surveyToText, textToSurvey, parsedQuestionsToWire, } from "wjx-api-sdk";
import { formatOutput } from "../lib/output.js";
import { CliError, handleError } from "../lib/errors.js";
import { getCredentials } from "../lib/auth.js";
import { executeCommand, strictInt, requireField, getMerged, createCapturingFetch, printDryRunPreview } from "../lib/command-helpers.js";
export function registerSurveyCommands(program) {
    const survey = program.command("survey").description("问卷管理");
    // --- list ---
    survey
        .command("list")
        .description("列出问卷")
        .option("--page <n>", "页码", strictInt)
        .option("--page_size <n>", "每页数量", strictInt)
        .option("--status <n>", "状态筛选", strictInt)
        .option("--atype <n>", "问卷类型", strictInt)
        .option("--name_like <s>", "名称搜索")
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, listSurveys, (m) => ({
            page_index: m.page,
            page_size: m.page_size,
            status: m.status,
            atype: m.atype,
            name_like: m.name_like,
        }));
    });
    // --- get ---
    survey
        .command("get")
        .description("获取问卷详情")
        .option("--vid <n>", "问卷ID", strictInt)
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, getSurvey, (m) => {
            requireField(m, "vid");
            return { vid: m.vid };
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
                questions: m.questions ?? "[]",
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
        .option("--type <n>", "问卷类型：1=调查, 6=考试", strictInt)
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
                api_setting: m.api_setting,
                after_submit_setting: m.after_submit_setting,
                msg_setting: m.msg_setting,
                sojumpparm_setting: m.sojumpparm_setting,
                time_setting: m.time_setting,
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