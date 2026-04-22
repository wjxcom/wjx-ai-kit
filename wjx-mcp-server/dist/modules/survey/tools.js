import { z } from "zod";
import { createSurvey, createSurveyByText, createSurveyByJson, getSurvey, listSurveys, updateSurveyStatus, getSurveySettings, updateSurveySettings, deleteSurvey, getQuestionTags, getTagDetails, clearRecycleBin, uploadFile, surveyToText, } from "./client.js";
import { toolResult, toolError } from "../../helpers.js";
import { QUESTION_TYPES } from "../../resources/survey-reference.js";
export function registerSurveyTools(server) {
    // ─── create_survey ────────────────────────────────────────────────
    server.registerTool("create_survey", {
        title: "创建问卷",
        description: "通过问卷星 OpenAPI 创建新问卷。支持两种模式：1) 全新创建：需传 atype/desc/questions；2) 复制已有问卷���传 source_vid 即可。" +
            "【重要】考试问卷必须设置 atype=6，考试中的单选/多选/填空题与普通题型使用相同的 q_type，区别在于问卷类型(atype)为6。" +
            "创建考试问卷后，需单独调用 update_survey_settings 的 time_setting 设置考试时间限制（max_answer_seconds=最长作答秒数）。" +
            "不要在 q_title 中包含题型标记（如[单选题]、[考试单选]等），题型由 q_type/q_subtype 决定。" +
            "【请勿创建测试问卷】每次调用都会创建真实问卷，直接按用户要求创建最终版本。" +
            "【OpenAPI 限制】多级下拉(501)和绘图(801)创建时可能回落为基础类型，建议创建后在页面手动调整。",
        inputSchema: {
            title: z.string().min(1).describe("问卷名称"),
            atype: z
                .number()
                .int()
                .optional()
                .describe("问卷类型：1=调查（默认）, 2=测评, 3=投票, 6=考试, 7=表单。考试问卷必须设为6，考试中的单选/多选/填空自动变为考试题型。注意：4(360度评估)、5(360评估无测评关系)、8(用户体系)、9(教学评估)、11(民主评议) 不支持通过 API 创建。不使用 source_vid 时必填"),
            desc: z.string().optional().describe("问卷描述。不使用 source_vid 时必填"),
            publish: z.boolean().optional().default(false).describe("是否立即发布"),
            questions: z
                .string()
                .min(2)
                .optional()
                .describe("题目列表 JSON 字符串。不使用 source_vid 时必填。每个题目必须包含 q_index（题号）、q_type（主题型）和 q_subtype（子类型，必填）。" +
                "【主题型 q_type】3=单选, 4=多选, 5=填空, 6=多项填空, 7=矩阵, 8=文件上传, 9=比重, 10=滑动条, 1=分页, 2=段落。" +
                "【子类型 q_subtype（必填！）】3=普通单选, 301=下拉框, 302=量表题, 303=评分单选, 305=判断题, 4=普通多选, 401=评分多选, 402=排序题, 403=商品题, 5=普通填空, 501=多级下拉, 6=普通多项填空, 601=考试多项填空, 602=考试完形填空, 8=文件上传, 801=绘图题, 9=比重, 10=滑动条。" +
                "【考试题型说明】考试单选=atype:6+q_type:3+q_subtype:3, 考试多选=atype:6+q_type:4+q_subtype:4, 考试单项填空=atype:6+q_type:5+q_subtype:5, 考试多项填空=q_type:6+q_subtype:601, 考试完形填空=q_type:6+q_subtype:602, 简答题=q_type:5+q_subtype:5。" +
                "【多项填空特殊要求】q_type=6 的多项填空题，q_title 中必须包含填空占位符 {_}（如：'姓名{_}，年龄{_}'），否则创建失败。" +
                "选择题需包含 items 数组，q_title 不要包含题型标记。" +
                "示例：[{\"q_index\":1,\"q_type\":3,\"q_subtype\":301,\"q_title\":\"城市\",\"items\":[{\"q_index\":1,\"item_index\":1,\"item_title\":\"北京\"},{\"q_index\":1,\"item_index\":2,\"item_title\":\"上海\"}]}]"),
            source_vid: z
                .string()
                .optional()
                .describe("源问卷编号，传入后从已有问卷复制创建，无需传 atype/desc/questions"),
            creater: z
                .string()
                .optional()
                .describe("创建者子账号用户名，不传则默认主账号"),
            compress_img: z
                .boolean()
                .optional()
                .describe("是否压缩问卷中的图片"),
            is_string: z
                .boolean()
                .optional()
                .describe("是否使用原始 activity string 格式"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
            title: "创建问卷",
        },
    }, async (args) => {
        try {
            let questionsStr = args.questions ?? "";
            // Auto-fix questions JSON before sending to API
            if (questionsStr) {
                try {
                    const questions = JSON.parse(questionsStr);
                    if (Array.isArray(questions)) {
                        let modified = false;
                        for (const q of questions) {
                            // Auto-insert {_} placeholders for multi-fill questions (q_type=6)
                            if (q.q_type === 6 && q.q_title && !q.q_title.includes("{_}")) {
                                const count = (q.items && q.items.length > 0) ? q.items.length : 2;
                                const placeholders = Array.from({ length: count }, () => "{_}").join("，");
                                const sep = /[：:，,、。.；;）)》>\s]$/.test(q.q_title) ? "" : "：";
                                q.q_title = `${q.q_title}${sep}${placeholders}`;
                                modified = true;
                            }
                            // Auto-assign item_score for scoring subtypes (量表302, 评分单选303, 评分多选401)
                            if ([302, 303, 401].includes(q.q_subtype) && Array.isArray(q.items)) {
                                for (const item of q.items) {
                                    if (item.item_score === undefined) {
                                        item.item_score = item.item_index ?? 1;
                                        modified = true;
                                    }
                                }
                            }
                        }
                        if (modified) {
                            questionsStr = JSON.stringify(questions);
                        }
                    }
                }
                catch { /* keep original string if parse fails */ }
            }
            const result = await createSurvey({
                title: args.title,
                type: args.atype ?? 1,
                description: args.desc ?? "",
                publish: args.publish,
                questions: questionsStr,
                source_vid: args.source_vid,
                creater: args.creater,
                compress_img: args.compress_img,
                is_string: args.is_string,
            });
            return toolResult(result, result.result === false);
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── get_survey ───────────────────────────────────────────────────
    server.registerTool("get_survey", {
        title: "获取问卷内容",
        description: "根据问卷编号获取问卷详情，包括题目和选项信息。支持 format 参数选择返回格式：json（结构化）、dsl（人类可读文本）、both（两者都返回）。",
        inputSchema: {
            vid: z.number().int().positive().describe("问卷编号"),
            format: z
                .enum(["json", "dsl", "both"])
                .optional()
                .default("json")
                .describe("返回格式：json=结构化 JSON（默认），dsl=人类可读 DSL 文本，both=两者都返回"),
            get_questions: z
                .boolean()
                .optional()
                .default(true)
                .describe("是否获取题目信息"),
            get_items: z
                .boolean()
                .optional()
                .default(true)
                .describe("是否获取选项信息"),
            get_exts: z
                .boolean()
                .optional()
                .describe("是否获取问答选项列表"),
            get_setting: z
                .boolean()
                .optional()
                .describe("是否获取题目设置信息"),
            get_page_cut: z
                .boolean()
                .optional()
                .describe("是否获取分页信息"),
            get_tags: z
                .boolean()
                .optional()
                .describe("是否获取绑定的题目标签信息"),
            showtitle: z
                .boolean()
                .optional()
                .describe("是否返回问卷标题"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
            title: "获取问卷内容",
        },
    }, async (args) => {
        try {
            const result = await getSurvey({
                vid: args.vid,
                get_questions: args.get_questions,
                get_items: args.get_items,
                get_exts: args.get_exts,
                get_setting: args.get_setting,
                get_page_cut: args.get_page_cut,
                get_tags: args.get_tags,
                showtitle: args.showtitle,
            });
            if (result.result === false) {
                return toolResult(result, true);
            }
            const fmt = args.format ?? "json";
            if (fmt === "dsl") {
                const dsl = surveyToText(result.data);
                return toolResult({ dsl }, false);
            }
            if (fmt === "both") {
                const dsl = surveyToText(result.data);
                return toolResult({ ...result, dsl }, false);
            }
            // default: json
            return toolResult(result, false);
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── list_surveys ─────────────────────────────────────────────────
    server.registerTool("list_surveys", {
        title: "获取问卷列表",
        description: "分页获取账户下的问卷列表，可按状态、类型、名称筛选。",
        inputSchema: {
            page_index: z
                .number()
                .int()
                .positive()
                .optional()
                .default(1)
                .describe("页码，从1开始"),
            page_size: z
                .number()
                .int()
                .min(1)
                .max(300)
                .optional()
                .default(10)
                .describe("每页数量（1-300）"),
            status: z
                .number()
                .int()
                .optional()
                .describe("问卷状态筛选"),
            atype: z
                .number()
                .int()
                .optional()
                .describe("问卷类型筛选：1=调查, 2=测评, 3=投票, 4=360度评估, 5=360评估无测评关系, 6=考试, 7=表单, 8=用户体系, 9=教学评估, 11=民主评议"),
            name_like: z
                .string()
                .max(10)
                .optional()
                .describe("按名称模糊搜索（最长10字符）"),
            sort: z
                .number()
                .int()
                .min(0)
                .max(5)
                .optional()
                .describe("排序：0=ID升序, 1=ID降序, 2=开始时间升序, 3=开始时间降序, 4=创建时间升序, 5=创建时间降序"),
            creater: z
                .string()
                .optional()
                .describe("指定子账号用户名筛选"),
            folder: z
                .string()
                .optional()
                .describe("文件夹名称筛选"),
            is_xingbiao: z
                .boolean()
                .optional()
                .describe("是否只获取星标问卷"),
            query_all: z
                .boolean()
                .optional()
                .describe("是否获取企业所有问卷（需管理员权限）"),
            verify_status: z
                .number()
                .int()
                .optional()
                .describe("审核状态筛选：1=已通过, 2=审核中, 3=未通过, 4=待实名"),
            time_type: z
                .number()
                .int()
                .min(0)
                .max(2)
                .optional()
                .describe("时间查询类型：0=创建时间, 1=开始时间, 2=结束时间"),
            begin_time: z
                .number()
                .optional()
                .describe("时间范围起始（毫秒时间戳）"),
            end_time: z
                .number()
                .optional()
                .describe("时间范围结束（毫秒时间戳）"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
            title: "获取问卷列表",
        },
    }, async (args) => {
        try {
            const result = await listSurveys({
                page_index: args.page_index,
                page_size: args.page_size,
                status: args.status,
                atype: args.atype,
                name_like: args.name_like,
                sort: args.sort,
                creater: args.creater,
                folder: args.folder,
                is_xingbiao: args.is_xingbiao,
                query_all: args.query_all,
                verify_status: args.verify_status,
                time_type: args.time_type,
                begin_time: args.begin_time,
                end_time: args.end_time,
            });
            return toolResult(result, result.result === false);
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── update_survey_status ─────────────────────────────────────────
    server.registerTool("update_survey_status", {
        title: "修改问卷状态",
        description: "修改问卷的发布状态：发布(1)、暂停(2)、删除(3)。" +
            "【状态转换规则】未发布(0)→已发布(1)；已发布(1)→已暂停(2)或已删除(3)；已暂停(2)→已发布(1)或已删除(3)。不可跳过中间状态（如从0直接到2），否则 API 会返回错误。",
        inputSchema: {
            vid: z.number().int().positive().describe("问卷编号"),
            state: z
                .number()
                .int()
                .min(1)
                .max(3)
                .describe("目标状态：1=发布, 2=暂停, 3=删除"),
        },
        annotations: {
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: true,
            title: "修改问卷状态",
        },
    }, async (args) => {
        try {
            const result = await updateSurveyStatus({ vid: args.vid, state: args.state });
            return toolResult(result, result.result === false);
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── get_survey_settings ──────────────────────────────────────────
    server.registerTool("get_survey_settings", {
        title: "获取问卷设置",
        description: "获取问卷的详细设置，包括时间设置、提交后跳转、考试设置、维度、奖品、数据推送等。",
        inputSchema: {
            vid: z.number().int().positive().describe("问卷编号"),
            additional_setting: z
                .string()
                .optional()
                .default("[1000,1001,1002,1003,1004,1005,1006,1007]")
                .describe("要获取的设置类别 JSON 数组字符串。默认获取全部：1000=时间设置, 1001=提交后设置, 1002=成绩单设置, 1003=维度设置, 1004=自定义参数设置, 1005=奖品设置, 1006=数据推送设置, 1007=问卷文件夹"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
            title: "获取问卷设置",
        },
    }, async (args) => {
        try {
            const result = await getSurveySettings({ vid: args.vid, additional_setting: args.additional_setting });
            return toolResult(result, result.result === false);
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── update_survey_settings ───────────────────────────────────────
    server.registerTool("update_survey_settings", {
        title: "修改问卷设置",
        description: "修改问卷的设置，包括 API 限制、提交后跳转、数据推送、自定义参数、时间设置等。每个设置项为 JSON 字符串。",
        inputSchema: {
            vid: z.number().int().positive().describe("问卷编号"),
            api_setting: z.string().optional().describe("API参与次数限制设置 JSON，格式：{\"limit_type\":<int>,\"passing_score\":<int>}。limit_type 值: 0=不限, 1=只许填写一次, -1=每天填写一次, -9999=及格后不允许再作答。passing_score: 及格分数（默认60），仅 limit_type=-9999 时生效"),
            after_submit_setting: z.string().optional().describe("提交后设置 JSON。跳转到指定页面：{\"go_redirect\":true,\"redirect_url\":\"https://example.com\",\"redirect_words\":\"即将跳转\"}。显示感谢信息：{\"show_thanks\":true,\"thank_words\":\"感谢参与\"}。注意：go_redirect 和 show_thanks 不能同时为 true"),
            msg_setting: z.string().optional().describe("数据推送设置 JSON，格式：{\"post_url\":\"https://example.com/webhook\",\"quick_post\":true,\"retry\":true}。【重要】此接口为全量覆盖，必须先通过 get_survey_settings（additional_setting 含 1006）获取当前完整推送配置，在现有配置基础上修改后再提交完整 JSON，否则未传字段（如 post_url）将被清空"),
            sojumpparm_setting: z.string().optional().describe("自定义链接参数设置 JSON，格式示例：{\"params\":[{\"name\":\"source\",\"type\":0}]} (注意：此接口仅修改当前问卷配置，不支持「应用到全局」)"),
            time_setting: z.string().optional().describe("时间设置 JSON，格式：{\"begin_time\":\"2026-04-01 00:00\",\"end_time\":\"2026-12-31 23:59\",\"max_answer_seconds\":3600,\"max_no_operat_seconds\":300,\"max_tab_screen_count\":3}。max_answer_seconds=最长作答秒数, max_no_operat_seconds=最长无操作自动交卷秒数, max_tab_screen_count=允许切屏最大次数。注意：OpenAPI 不支持设置最短作答时间"),
        },
        annotations: {
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: true,
            title: "修改问卷设置",
        },
    }, async (args) => {
        try {
            const hasAnySetting = args.api_setting !== undefined ||
                args.after_submit_setting !== undefined ||
                args.msg_setting !== undefined ||
                args.sojumpparm_setting !== undefined ||
                args.time_setting !== undefined;
            if (!hasAnySetting) {
                return toolResult({ error: "至少需要提供一个设置项" }, true);
            }
            // 在 handler 中验证 JSON 格式（避免 Zod .refine() 导致 MCP 挂起）
            for (const [key, val] of Object.entries({
                api_setting: args.api_setting,
                after_submit_setting: args.after_submit_setting,
                msg_setting: args.msg_setting,
                sojumpparm_setting: args.sojumpparm_setting,
                time_setting: args.time_setting,
            })) {
                if (val !== undefined) {
                    try {
                        JSON.parse(val);
                    }
                    catch {
                        throw new Error(`${key} 必须是合法的 JSON 字符串`);
                    }
                }
            }
            const result = await updateSurveySettings({
                vid: args.vid,
                api_setting: args.api_setting,
                after_submit_setting: args.after_submit_setting,
                msg_setting: args.msg_setting,
                sojumpparm_setting: args.sojumpparm_setting,
                time_setting: args.time_setting,
            });
            return toolResult(result, result.result === false);
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── delete_survey ────────────────────────────────────────────────
    server.registerTool("delete_survey", {
        title: "删除问卷",
        description: "永久删除问卷。可选择彻底删除（不进回收站）。此操作不可逆，请谨慎使用。",
        inputSchema: {
            vid: z.number().int().positive().describe("问卷编号"),
            username: z.string().min(1).describe("用户名（主账户/系统管理员/问卷创建者子账号）"),
            completely_delete: z.boolean().optional().describe("是否彻底删除（不进回收站）"),
        },
        annotations: {
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: true,
            title: "删除问卷",
        },
    }, async (args) => {
        try {
            const result = await deleteSurvey({
                vid: args.vid,
                username: args.username,
                completely_delete: args.completely_delete,
            });
            return toolResult(result, result.result === false);
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── get_question_tags ────────────────────────────────────────────
    server.registerTool("get_question_tags", {
        title: "获取题目标签",
        description: "获取指定用户所在企业的所有题目标签列表。",
        inputSchema: {
            username: z.string().min(1).describe("用户名"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
            title: "获取题目标签",
        },
    }, async (args) => {
        try {
            const result = await getQuestionTags({ username: args.username });
            return toolResult(result, result.result === false);
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── get_tag_details ──────────────────────────────────────────────
    server.registerTool("get_tag_details", {
        title: "获取题目标签详情",
        description: "根据标签 ID 获取标签下的题目详情列表，包括关联的问卷、题目类型和标签名称。",
        inputSchema: {
            tag_id: z.number().int().positive().describe("标签 ID"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
            title: "获取题目标签详情",
        },
    }, async (args) => {
        try {
            const result = await getTagDetails({ tag_id: args.tag_id });
            // Enrich q_type with human-readable description
            if (result.result !== false && Array.isArray(result.data)) {
                for (const item of result.data) {
                    const qType = Number(item.q_type);
                    if (!isNaN(qType) && QUESTION_TYPES[qType]) {
                        item.q_type_name = QUESTION_TYPES[qType].name;
                    }
                }
            }
            return toolResult(result, result.result === false);
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── upload_file ─────────────────────────────────────────────────
    server.registerTool("upload_file", {
        title: "上传文件",
        description: "上传图片文件用于问卷。支持 png/jpg/gif/jpeg/bmp/webp 格式，文件以 Base64 编码传入，最大约 4MB。",
        inputSchema: {
            file_name: z.string().min(1).describe("文件名，须含扩展名（.png/.jpg/.gif/.jpeg/.bmp/.webp）"),
            file: z.string().min(1).describe("Base64 编码的文件内容"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
            title: "上传文件",
        },
    }, async (args) => {
        try {
            const result = await uploadFile({
                file_name: args.file_name,
                file: args.file,
            });
            return toolResult(result, result.result === false);
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── clear_recycle_bin ────────────────────────────────────────────
    server.registerTool("clear_recycle_bin", {
        title: "清空回收站",
        description: "清空回收站中的问卷。若指定 vid 则仅彻底删除该问卷，否则清空整个回收站。此操作不可逆！",
        inputSchema: {
            username: z.string().min(1).describe("用户名（只能清空该用户创建的问卷）"),
            vid: z.number().int().positive().optional().describe("问卷编号（指定则仅删除该问卷，否则清空回收站）"),
        },
        annotations: {
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: true,
            title: "清空回收站",
        },
    }, async (args) => {
        try {
            const result = await clearRecycleBin({
                username: args.username,
                vid: args.vid,
            });
            return toolResult(result, result.result === false);
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── create_survey_by_text ────────────────────────────────────────
    server.registerTool("create_survey_by_text", {
        title: "用 DSL 文本创建问卷",
        description: "（简单场景备选，仅支持约 25 种题型）通过人类可读的 DSL 文本创建问卷。文本格式与 get_survey(format='dsl') 输出一致。" +
            "支持题型标签：[单选题]、[下拉框]/[下拉单选]、[多选题]、[填空题]、[简答题]/[问答题]、[多项填空题]、[量表题]、[评分单选]、[评分多选]、[排序题]、[判断题]、[比重题]、[滑动条]、[矩阵题]、[矩阵量表题]、[矩阵单选题]、[矩阵多选题]、[矩阵填空题]、[文件上传]、[绘图题]、[段落说明]、[商品题]、[多级下拉题]、[考试多项填空]、[考试完形填空]。" +
            "【考试题型】创建考试问卷时设 atype=6，考试中的单选/多选/填空自动变为考试题型。" +
            "【多项填空/考试填空】题目标题中必须包含填空占位符 {_}，如：'The boy {_} a student'。" +
            "【API 限制】考试问卷的正确答案和分值无法通过 API 设置，需在问卷星网页端手动配置。" +
            "q_title 不要包含题型标记。" +
            "输入示例：\n" +
            "用户满意度调查\n\n" +
            "请认真填写\n\n" +
            "1. 整体满意度[单选题]\n" +
            "非常满意\n满意\n不满意\n\n" +
            "2. 建议[填空题]（选填）",
        inputSchema: {
            text: z.string().min(1).describe("DSL 格式的问卷文本"),
            atype: z
                .number()
                .int()
                .optional()
                .default(1)
                .describe("问卷类型：1=调查（默认）, 2=测评, 3=投票, 6=考试, 7=表单"),
            publish: z.boolean().optional().default(false).describe("是否立即发布"),
            creater: z.string().optional().describe("创建者子账号用户名"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
            title: "用 DSL 文本创建问卷",
        },
    }, async (args) => {
        try {
            const result = await createSurveyByText({
                text: args.text,
                atype: args.atype,
                publish: args.publish,
                creater: args.creater,
            });
            return toolResult(result, result.result === false);
        }
        catch (error) {
            return toolError(error);
        }
    });
    // ─── create_survey_by_json ───────────────────────────────────────
    server.registerTool("create_survey_by_json", {
        title: "用 JSON 创建问卷",
        description: "（推荐，支持 70+ 题型）通过 JSONL 格式创建问卷。每行一个 JSON 对象，首行为 qtype='问卷基础信息' 的元数据。" +
            "支持 70+ 种题型（普通调查、专业调查模型、考试、表单），远多于 DSL 文本格式。" +
            "【核心字段】qtype（题型名称）、title（标题）、select（选项数组）、rowtitle（行标题，仅矩阵/比重/Kano/PSM/表格题 使用）、requir（是否必填）。" +
            "【专业模型】支持 BWS/MaxDiff(mdattr)、联合分析(columntitle)、品牌漏斗(brands)、Kano模型、SUS模型、PSM模型等。" +
            "【考试题型】支持 correctselect（正确答案）、quizscore（分值）、answeranalysis（答案解析）。" +
            "【关联逻辑】支持 relation（显示条件）、referselect（引用前题选项）。" +
            "【硬性校验 — 不满足会被 SDK 拒绝】1) 标题不得为空、占位符（??? / 无标题 / TODO / xxx 等）或少于 2 字；2) JSONL 必须包含至少 1 道真实题目（_meta/分页栏/段落说明/知情同意书不计入）。" +
            "【多项填空必看】多项填空 qtype='多项填空'，子填空位数量由 title 中的 {_} 占位符数量决定，例如 title='电话 {_}，邮箱 {_}，微信 {_}' 会生成 3 个空位；**禁止用 rowtitle 数组**（多项填空不支持该字段，服务端会忽略并只生成 1 个空位）。考试多项填空/考试完形填空同理。" +
            "【表格类题型 707-712】服务端原生支持，多字段批量录入场景请优先使用：" +
            "表格填空题(707) 行=条目/列=字段名 全部填空；" +
            "表格下拉框(708) 行=条目/列=维度，每格下拉评价；" +
            "表格组合题(709) 行=成员/列=不同字段；" +
            "表格自增题(710) 用户运行时自加行（仅传 select 列定义，不传 rowtitle）；" +
            "多项文件题(711) rowtitle 列出每个上传项；" +
            "多项简答题(712) rowtitle 列出每个简答子题。" +
            "输入示例（JSONL）：\n" +
            '{"qtype":"问卷基础信息","title":"客户满意度调查","introduction":"请认真填写"}\n' +
            '{"qtype":"单选","title":"您的性别","select":["男","女"]}\n' +
            '{"qtype":"多项填空","title":"联系方式：电话 {_}，邮箱 {_}"}\n' +
            '{"qtype":"表格组合题","title":"团队成员","rowtitle":["成员1","成员2"],"select":["姓名","年龄","性别"]}\n' +
            '{"qtype":"量表题","title":"满意度评分","select":["1","2","3","4","5"],"minvaluetext":"非常不满意","maxvaluetext":"非常满意"}',
        inputSchema: {
            jsonl: z.string().min(1).max(1_000_000).describe("JSONL 格式的问卷内容（每行一个 JSON 对象）。" +
                "硬性要求：1) 首行 _meta 的 title 必须是真实主题，不得为占位符 ??? / 无标题 / TODO / xxx；" +
                "2) 必须包含 ≥1 道真实题目（元数据/分页/段落/知情同意书不计）；违反会被 SDK 拒绝。"),
            title: z.string().optional().describe("覆盖 JSONL 中的问卷标题。同样适用占位符校验：禁止 ??? / 无标题 / TODO / xxx 等无语义值。"),
            atype: z
                .number()
                .int()
                .optional()
                .describe("问卷类型（**调用方应主动判断并显式传入**，不要依赖兜底）：" +
                "1=调查（默认）, 2=测评, 3=投票, 6=考试, 7=表单。" +
                "硬性规则：投票场景 → 必传 atype=3；表单 → 必传 atype=7；考试 → 必传 atype=6；测评 → 必传 atype=2。" +
                "兜底（仅用于调用方遗漏时挽救，不应作为正常路径）：含考试题型→6；标题含「投票」→3；含「表单/报名表/登记表/申请表」→7；含「测评」→2；其余 1。" +
                "显式传值始终优先于兜底推断。"),
            publish: z.boolean().optional().default(false).describe("是否立即发布"),
            creater: z.string().optional().describe("创建者子账号用户名"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
            title: "用 JSON 创建问卷",
        },
    }, async (args) => {
        try {
            const result = await createSurveyByJson({
                jsonl: args.jsonl,
                title: args.title,
                atype: args.atype,
                publish: args.publish,
                creater: args.creater,
            });
            return toolResult(result, result.result === false);
        }
        catch (error) {
            return toolError(error);
        }
    });
}
//# sourceMappingURL=tools.js.map