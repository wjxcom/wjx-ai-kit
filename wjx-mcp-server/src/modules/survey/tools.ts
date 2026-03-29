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
} from "./client.js";
import { toolResult, toolError } from "../../helpers.js";

export function registerSurveyTools(server: McpServer): void {
  // ─── create_survey ────────────────────────────────────────────────
  server.registerTool(
    "create_survey",
    {
      title: "创建问卷",
      description:
        "通过问卷星 OpenAPI 创建新问卷。支持两种模式：1) 全新创建：需传 atype/desc/questions；2) 复制已有问卷：传 source_vid 即可。",
      inputSchema: {
        title: z.string().min(1).describe("问卷名称"),
        atype: z
          .number()
          .int()
          .optional()
          .describe("问卷类型：1=调查, 2=测评, 3=投票, 4=360度评估, 5=360评估无测评关系, 6=考试, 7=表单, 8=用户体系, 9=教学评估, 11=民主评议。不使用 source_vid 时必填"),
        desc: z.string().optional().describe("问卷描述。不使用 source_vid 时必填"),
        publish: z.boolean().optional().default(false).describe("是否立即发布"),
        questions: z
          .string()
          .min(2)
          .optional()
          .describe(
            "题目列表 JSON 字符串。不使用 source_vid 时必填。每个题目必须包含 q_index（题号）和 q_type（题型编码：3=单选,4=多选,5=填空,6=多项填空,7=矩阵,8=文件上传,9=比重,10=滑动条,1=分页,2=段落）。常用子类型：301=下拉框,302=量表题,303=评分单选,305=判断题,401=评分多选,402=排序题,601=考试多项填空,602=考试完型填空,701-712=矩阵子类型,801=绘图题。完整子类型请参考 question-types resource。选择题需包含 items 数组。示例：[{\"q_index\":1,\"q_type\":3,\"q_title\":\"您的性别\",\"items\":[{\"q_index\":1,\"item_index\":1,\"item_title\":\"男\"},{\"q_index\":1,\"item_index\":2,\"item_title\":\"女\"}]}]",
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
          type: args.atype ?? 0,
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
        "根据问卷编号获取问卷详情，包括题目和选项信息。",
      inputSchema: {
        vid: z.number().int().positive().describe("问卷编号"),
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
        return toolResult(result, result.result === false);
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
          .describe("审核状态筛选：0=未审核, 1=审核通过, 2=审核中, 3=审核未通过"),
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
        ).optional().describe("API请求次数限制设置 JSON"),
        after_submit_setting: z.string().refine(
          (s) => { try { JSON.parse(s); return true; } catch { return false; } },
          "after_submit_setting 必须是合法的 JSON 字符串",
        ).optional().describe("作答后跳转设置 JSON"),
        msg_setting: z.string().refine(
          (s) => { try { JSON.parse(s); return true; } catch { return false; } },
          "msg_setting 必须是合法的 JSON 字符串",
        ).optional().describe("数据推送设置 JSON"),
        sojumpparm_setting: z.string().refine(
          (s) => { try { JSON.parse(s); return true; } catch { return false; } },
          "sojumpparm_setting 必须是合法的 JSON 字符串",
        ).optional().describe("自定义链接参数设置 JSON"),
        time_setting: z.string().refine(
          (s) => { try { JSON.parse(s); return true; } catch { return false; } },
          "time_setting 必须是合法的 JSON 字符串",
        ).optional().describe("时间设置 JSON（开始/结束时间、每日时段、考试时间限制等）"),
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
}
