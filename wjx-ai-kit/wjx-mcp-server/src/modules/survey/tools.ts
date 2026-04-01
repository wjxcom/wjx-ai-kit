import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createSurvey,
  getSurvey,
  listSurveys,
  updateSurveyStatus,
  getSurveySettings,
  updateSurveySettings,
  deleteSurvey,
  getQuestionTags,
  getTagDetails,
  clearRecycleBin,
  uploadFile,
  surveyToText,
  textToSurvey,
} from "./client.js";
import type { SurveyDetail, ParsedQuestion } from "./client.js";
import { toolResult, toolError } from "../../helpers.js";
import { QUESTION_TYPES } from "../../resources/survey-reference.js";

export function registerSurveyTools(server: McpServer): void {
  // ─── create_survey ────────────────────────────────────────────────
  server.registerTool(
    "create_survey",
    {
      title: "创建问卷",
      description:
        "通过问卷星 OpenAPI 创建新问卷。支持两种模式：1) 全新创建：需传 atype/desc/questions；2) 复制已有问卷：传 source_vid 即可。" +
        "【重要】考试问卷必须设置 atype=6，考试中的单选/多选/填空题与普通题型使用相同的 q_type，区别在于问卷类型(atype)为6。" +
        "创建考试问卷后，需单独调用 update_survey_settings 的 time_setting 设置考试时间限制（exam_min_seconds/exam_max_seconds）。" +
        "不要在 q_title 中包含题型标记（如[单选题]、[考试单选]等），题型由 q_type/q_subtype 决定。",
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
          .describe(
            "题目列表 JSON 字符串。不使用 source_vid 时必填。每个题目必须包含 q_index（题号）、q_type（主题型）和 q_subtype（子类型，必填）。" +
            "【主题型 q_type】3=单选, 4=多选, 5=填空, 6=多项填空, 7=矩阵, 8=文件上传, 9=比重, 10=滑动条, 1=分页, 2=段落。" +
            "【子类型 q_subtype（必填！）】3=普通单选, 301=下拉框, 302=量表题, 303=评分单选, 305=判断题, 4=普通多选, 401=评分多选, 402=排序题, 403=商品题, 5=普通填空, 501=多级下拉, 6=普通多项填空, 601=考试多项填空, 602=考试完形填空, 8=文件上传, 801=绘图题, 9=比重, 10=滑动条。" +
            "【考试题型说明】考试单选=atype:6+q_type:3+q_subtype:3, 考试多选=atype:6+q_type:4+q_subtype:4, 考试单项填空=atype:6+q_type:5+q_subtype:5, 考试多项填空=q_type:6+q_subtype:601, 考试完形填空=q_type:6+q_subtype:602, 简答题=q_type:5+q_subtype:5。" +
            "【多项填空特殊要求】q_type=6 的多项填空题，q_title 中必须包含填空占位符 {_}（如：'姓名{_}，年龄{_}'），否则创建失败。" +
            "选择题需包含 items 数组，q_title 不要包含题型标记。" +
            "示例：[{\"q_index\":1,\"q_type\":3,\"q_subtype\":301,\"q_title\":\"城市\",\"items\":[{\"q_index\":1,\"item_index\":1,\"item_title\":\"北京\"},{\"q_index\":1,\"item_index\":2,\"item_title\":\"上海\"}]}]",
          ),
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
    },
    async (args) => {
      try {
        const result = await createSurvey({
          title: args.title,
          type: args.atype ?? 1,
          description: args.desc ?? "",
          publish: args.publish,
          questions: args.questions ?? "",
          source_vid: args.source_vid,
          creater: args.creater,
          compress_img: args.compress_img,
          is_string: args.is_string,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── get_survey ───────────────────────────────────────────────────
  server.registerTool(
    "get_survey",
    {
      title: "获取问卷内容",
      description:
        "根据问卷编号获取问卷详情，包括题目和选项信息。支持 format 参数选择返回格式：json（结构化）、dsl（人类可读文本）、both（两者都返回）。",
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
    },
    async (args) => {
      try {
        const result = await getSurvey<SurveyDetail>({
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
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── list_surveys ─────────────────────────────────────────────────
  server.registerTool(
    "list_surveys",
    {
      title: "获取问卷列表",
      description:
        "分页获取账户下的问卷列表，可按状态、类型、名称筛选。",
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
          .describe("问卷类型筛选：1=调查, 2=测评, 3=投票, 4=360度评估, 5=360评估无测评关系, 6=考试, 7=表单, 8=用户体系, 9=教学评估, 10=量表, 11=民主评议"),
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
    },
    async (args) => {
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
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── update_survey_status ─────────────────────────────────────────
  server.registerTool(
    "update_survey_status",
    {
      title: "修改问卷状态",
      description:
        "修改问卷的发布状态：发布(1)、暂停(2)、删除(3)。",
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
    },
    async (args) => {
      try {
        const result = await updateSurveyStatus({ vid: args.vid, state: args.state });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── get_survey_settings ──────────────────────────────────────────
  server.registerTool(
    "get_survey_settings",
    {
      title: "获取问卷设置",
      description:
        "获取问卷的详细设置，包括时间设置、提交后跳转、考试设置、维度、奖品、数据推送等。",
      inputSchema: {
        vid: z.number().int().positive().describe("问卷编号"),
        additional_setting: z
          .string()
          .optional()
          .default("[1000,1001,1002,1003,1004,1005]")
          .describe(
            "要获取的设置类别 JSON 数组字符串。默认获取全部：1000=基本信息, 1001=提交后设置, 1002=时间设置, 1003=消息推送, 1004=参数设置, 1005=API设置",
          ),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: "获取问卷设置",
      },
    },
    async (args) => {
      try {
        const result = await getSurveySettings({ vid: args.vid, additional_setting: args.additional_setting });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── update_survey_settings ───────────────────────────────────────
  server.registerTool(
    "update_survey_settings",
    {
      title: "修改问卷设置",
      description:
        "修改问卷的设置，包括 API 限制、提交后跳转、数据推送、自定义参数、时间设置等。每个设置项为 JSON 字符串。",
      inputSchema: {
        vid: z.number().int().positive().describe("问卷编号"),
        api_setting: z.string().refine(
          (s) => { try { JSON.parse(s); return true; } catch { return false; } },
          "api_setting 必须是合法的 JSON 字符串",
        ).optional().describe("API请求次数限制设置 JSON，格式示例：{\"max_times\":100,\"pass_score\":60,\"pass_no_allow\":true}"),
        after_submit_setting: z.string().refine(
          (s) => { try { JSON.parse(s); return true; } catch { return false; } },
          "after_submit_setting 必须是合法的 JSON 字符串",
        ).optional().describe("作答后跳转设置 JSON，格式示例：{\"type\":1,\"url\":\"https://example.com\",\"thank_word\":\"感谢参与\",\"jump_tip\":\"即将跳转\"} (type: 0=显示感谢信息, 1=跳转到指定页面)"),
        msg_setting: z.string().refine(
          (s) => { try { JSON.parse(s); return true; } catch { return false; } },
          "msg_setting 必须是合法的 JSON 字符串",
        ).optional().describe("数据推送设置 JSON，格式示例：{\"push_url\":\"https://example.com/webhook\",\"quick_post\":true,\"retry\":true,\"is_encrypt\":0} (注意：必须同时传完整配置，否则未传字段可能被清空)"),
        sojumpparm_setting: z.string().refine(
          (s) => { try { JSON.parse(s); return true; } catch { return false; } },
          "sojumpparm_setting 必须是合法的 JSON 字符串",
        ).optional().describe("自定义链接参数设置 JSON，格式示例：{\"params\":[{\"name\":\"source\",\"type\":0}]} (注意：此接口仅修改当前问卷配置，不支持「应用到全局」)"),
        time_setting: z.string().refine(
          (s) => { try { JSON.parse(s); return true; } catch { return false; } },
          "time_setting 必须是合法的 JSON 字符串",
        ).optional().describe("时间设置 JSON，格式示例：{\"start_time\":\"2026-04-01 00:00\",\"end_time\":\"2026-12-31 23:59\",\"exam_min_seconds\":60,\"exam_max_seconds\":3600} (考试时间限制：exam_min_seconds=最短作答秒数, exam_max_seconds=最长作答秒数)"),
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
        title: "修改问卷设置",
      },
    },
    async (args) => {
      try {
        const hasAnySetting =
          args.api_setting !== undefined ||
          args.after_submit_setting !== undefined ||
          args.msg_setting !== undefined ||
          args.sojumpparm_setting !== undefined ||
          args.time_setting !== undefined;
        if (!hasAnySetting) {
          return toolResult({ error: "至少需要提供一个设置项" }, true);
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
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── delete_survey ────────────────────────────────────────────────
  server.registerTool(
    "delete_survey",
    {
      title: "删除问卷",
      description:
        "永久删除问卷。可选择彻底删除（不进回收站）。此操作不可逆，请谨慎使用。",
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
    },
    async (args) => {
      try {
        const result = await deleteSurvey({
          vid: args.vid,
          username: args.username,
          completely_delete: args.completely_delete,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── get_question_tags ────────────────────────────────────────────
  server.registerTool(
    "get_question_tags",
    {
      title: "获取题目标签",
      description:
        "获取指定用户所在企业的所有题目标签列表。",
      inputSchema: {
        username: z.string().min(1).describe("用户名"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: "获取题目标签",
      },
    },
    async (args) => {
      try {
        const result = await getQuestionTags({ username: args.username });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── get_tag_details ──────────────────────────────────────────────
  server.registerTool(
    "get_tag_details",
    {
      title: "获取题目标签详情",
      description:
        "根据标签 ID 获取标签下的题目详情列表，包括关联的问卷、题目类型和标签名称。",
      inputSchema: {
        tag_id: z.number().int().positive().describe("标签 ID"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: "获取题目标签详情",
      },
    },
    async (args) => {
      try {
        const result = await getTagDetails({ tag_id: args.tag_id });
        // Enrich q_type with human-readable description
        if (result.result !== false && Array.isArray(result.data)) {
          for (const item of result.data as Array<Record<string, unknown>>) {
            const qType = Number(item.q_type);
            if (!isNaN(qType) && QUESTION_TYPES[qType]) {
              item.q_type_name = QUESTION_TYPES[qType].name;
            }
          }
        }
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── upload_file ─────────────────────────────────────────────────
  server.registerTool(
    "upload_file",
    {
      title: "上传文件",
      description:
        "上传图片文件用于问卷。支持 png/jpg/gif/jpeg/bmp/webp 格式，文件以 Base64 编码传入，最大约 4MB。",
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
    },
    async (args) => {
      try {
        const result = await uploadFile({
          file_name: args.file_name,
          file: args.file,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── clear_recycle_bin ────────────────────────────────────────────
  server.registerTool(
    "clear_recycle_bin",
    {
      title: "清空回收站",
      description:
        "清空回收站中的问卷。若指定 vid 则仅彻底删除该问卷，否则清空整个回收站。此操作不可逆！",
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
    },
    async (args) => {
      try {
        const result = await clearRecycleBin({
          username: args.username,
          vid: args.vid,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── create_survey_by_text ────────────────────────────────────────
  server.registerTool(
    "create_survey_by_text",
    {
      title: "用 DSL 文本创建问卷",
      description:
        "通过人类可读的 DSL 文本创建问卷。文本格式与 get_survey(format='dsl') 输出一致。" +
        "支持题型标签：[单选题]、[下拉框]/[下拉单选]、[多选题]、[填空题]、[简答题]/[问答题]、[多项填空题]、[量表题]、[评分单选]、[评分多选]、[排序题]、[判断题]、[比重题]、[滑动条]、[矩阵题]、[矩阵量表题]、[矩阵单选题]、[矩阵多选题]、[矩阵填空题]、[文件上传]、[绘图题]、[段落说明]、[商品题]、[多级下拉题]、[考试多项填空]、[考试完形填空]。" +
        "【考试题型】创建考试问卷时设 atype=6，考试中的单选/多选/填空自动变为考试题型。" +
        "【多项填空/考试填空】题目标题中必须包含填空占位符 {_}，如：'The boy {_} a student'。" +
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
    },
    async (args) => {
      try {
        const parsed = textToSurvey(args.text);
        if (!parsed.title) {
          return toolError("DSL 文本缺少标题（第一行应为问卷标题）");
        }
        if (parsed.questions.length === 0) {
          return toolError("DSL 文本中未找到任何题目");
        }

        const questions = parsedQuestionsToWire(parsed.questions);
        const result = await createSurvey({
          title: parsed.title,
          type: args.atype ?? 1,
          description: parsed.description,
          publish: args.publish,
          questions: JSON.stringify(questions),
          creater: args.creater,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}

// ─── ParsedQuestion → API wire format conversion ──────────────────

const TYPE_MAP: Record<string, { q_type: number; q_subtype: number }> = {
  "single-choice": { q_type: 3, q_subtype: 3 },
  "dropdown": { q_type: 3, q_subtype: 301 },
  "multi-choice": { q_type: 4, q_subtype: 4 },
  "fill-in": { q_type: 5, q_subtype: 5 },
  "multi-fill": { q_type: 6, q_subtype: 6 },
  "exam-multi-fill": { q_type: 6, q_subtype: 601 },
  "exam-cloze": { q_type: 6, q_subtype: 602 },
  "scale": { q_type: 3, q_subtype: 302 },
  "scoring-single": { q_type: 3, q_subtype: 303 },
  "scoring-multi": { q_type: 4, q_subtype: 401 },
  "sort": { q_type: 4, q_subtype: 402 },
  "commodity": { q_type: 4, q_subtype: 403 },
  "true-false": { q_type: 3, q_subtype: 305 },
  "weight": { q_type: 9, q_subtype: 9 },
  "slider": { q_type: 10, q_subtype: 10 },
  "matrix": { q_type: 7, q_subtype: 7 },
  "matrix-scale": { q_type: 7, q_subtype: 701 },
  "matrix-single": { q_type: 7, q_subtype: 702 },
  "matrix-multi": { q_type: 7, q_subtype: 703 },
  "matrix-fill": { q_type: 7, q_subtype: 704 },
  "paragraph": { q_type: 2, q_subtype: 2 },
  "file-upload": { q_type: 8, q_subtype: 8 },
  "drawing": { q_type: 8, q_subtype: 801 },
  "multi-level-dropdown": { q_type: 5, q_subtype: 501 },
  "scenario": { q_type: 3, q_subtype: 304 },
};

interface WireQuestion {
  q_index: number;
  q_type: number;
  q_subtype: number;
  q_title: string;
  is_requir: boolean;
  items?: { q_index: number; item_index: number; item_title: string }[];
}

function parsedQuestionsToWire(questions: ParsedQuestion[]): WireQuestion[] {
  const unsupported = questions
    .filter((q) => !TYPE_MAP[q.type])
    .map((q) => `"${q.title}" (type: ${q.type})`);
  if (unsupported.length > 0) {
    const supported = Object.keys(TYPE_MAP).join(", ");
    throw new Error(
      `DSL 包含不支持的题型，无法创建：${unsupported.join("；")}。` +
      `骨架支持的题型：${supported}`,
    );
  }

  const wire: WireQuestion[] = [];
  let qIdx = 1;

  for (const q of questions) {
    const typeInfo = TYPE_MAP[q.type]!;

    const wq: WireQuestion = {
      q_index: qIdx,
      q_type: typeInfo.q_type,
      q_subtype: typeInfo.q_subtype,
      q_title: q.title,
      is_requir: q.required,
    };

    // Multi-fill types (q_type=6) require {_} placeholders in q_title
    if (typeInfo.q_type === 6 && !wq.q_title.includes("{_}")) {
      // Auto-insert placeholders based on options count or default to 2
      const count = (q.options && q.options.length > 0) ? q.options.length : 2;
      const placeholders = Array.from({ length: count }, () => "{_}").join("，");
      const separator = /[：:，,、。.；;）)》>\s]$/.test(wq.q_title) ? "" : "：";
      wq.q_title = `${wq.q_title}${separator}${placeholders}`;
    }

    // Convert options to items
    if (q.options && q.options.length > 0) {
      wq.items = q.options.map((opt, i) => ({
        q_index: qIdx,
        item_index: i + 1,
        item_title: opt,
      }));
    }

    // Scale: convert scaleRange to items
    if ((q.type === "scale" || q.type === "slider") && q.scaleRange) {
      const [min, max] = q.scaleRange;
      const minNum = parseInt(min, 10);
      const maxNum = parseInt(max, 10);
      if (!isNaN(minNum) && !isNaN(maxNum)) {
        wq.items = [];
        for (let v = minNum; v <= maxNum; v++) {
          wq.items.push({ q_index: qIdx, item_index: v - minNum + 1, item_title: String(v) });
        }
      } else {
        // Non-numeric scale labels (e.g. "非常不满意~非常满意")
        wq.items = [
          { q_index: qIdx, item_index: 1, item_title: min },
          { q_index: qIdx, item_index: 2, item_title: max },
        ];
      }
    }

    // Matrix: convert matrixRows to items
    if (q.type.startsWith("matrix") && q.matrixRows && q.matrixRows.length > 0) {
      wq.items = q.matrixRows.map((row, i) => ({
        q_index: qIdx,
        item_index: i + 1,
        item_title: row,
      }));
    }

    wire.push(wq);
    qIdx++;
  }

  return wire;
}
