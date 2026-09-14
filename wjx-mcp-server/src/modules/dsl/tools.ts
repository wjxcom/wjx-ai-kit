import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { assertApiResponse, toolApiResult, toolError, toolResult } from "../../helpers.js";
import { createSurveyByWjxDsl, generateWjxDsl, queryWjxDsl, updateWjxDsl } from "./client.js";
import { verifyWjxDslWrite } from "wjx-api-sdk";

const MAX_DSL_BYTES = 4 * 1024 * 1024;
const dslSchema = z.string().min(1).refine((value) => Buffer.byteLength(value, "utf8") <= MAX_DSL_BYTES, `DSL UTF-8 字节数不能超过 ${MAX_DSL_BYTES}`);
const vidSchema = z.union([z.string().min(1), z.number().int().positive()]);

export function registerDslTools(server: McpServer): void {
  server.registerTool("query_wjx_dsl", {
    title: "查询 WJX XML DSL 问卷",
    description: "使用传统编码 vid 查询问卷，返回原有查询内容和 XML DSL 往返结果；可选读取扩展名、设置、分页/段落和标签。",
    inputSchema: {
      vid: vidSchema,
      get_exts: z.boolean().optional(),
      get_setting: z.boolean().optional(),
      get_page_cut: z.boolean().optional(),
      get_tags: z.boolean().optional(),
      showtitle: z.boolean().optional(),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true, title: "查询 WJX XML DSL 问卷" },
  }, async (args) => {
    try {
      const result = await queryWjxDsl({
        vid: args.vid,
        ...(args.get_exts === undefined ? {} : { get_exts: args.get_exts }),
        ...(args.get_setting === undefined ? {} : { get_setting: args.get_setting }),
        ...(args.get_page_cut === undefined ? {} : { get_page_cut: args.get_page_cut }),
        ...(args.get_tags === undefined ? {} : { get_tags: args.get_tags }),
        ...(args.showtitle === undefined ? {} : { showtitle: args.showtitle }),
      });
      return toolApiResult(result);
    } catch (error) { return toolError(error); }
  });

  server.registerTool("generate_wjx_dsl", {
    title: "校验 WJX XML DSL",
    description: "接收 AI 按 wjx-dsl v1 规范生成的 DSL，执行轻量协议校验和规范化；不写入服务器。",
    inputSchema: { dsl: dslSchema },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, title: "校验 WJX XML DSL" },
  }, async (args) => {
    try {
      const result = generateWjxDsl(args.dsl);
      return toolResult(result, !result.valid);
    } catch (error) { return toolError(error); }
  });

  server.registerTool("create_survey_from_definition", {
    title: "使用 DSL 定义创建问卷",
    description: "接收 AI 生成的完整 WJX XML DSL，校验通过后调用 A1000109 创建问卷，并尝试读回 DSL、状态和链接验证写入。definition 指 DSL 文本，不是 JSON 问卷模型。",
    inputSchema: {
      dsl: dslSchema,
      atype: z.number().int().positive().optional(),
      publish: z.boolean().optional(),
      compress_img: z.boolean().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true, title: "使用 DSL 定义创建问卷" },
  }, async (args) => {
    try {
      const result = await createSurveyByWjxDsl({ dsl: args.dsl, ...(args.atype === undefined ? {} : { atype: args.atype }), ...(args.publish === undefined ? {} : { publish: args.publish }), ...(args.compress_img === undefined ? {} : { compress_img: args.compress_img }) });
      assertApiResponse(result);
      if (result.result !== true) return toolApiResult(result);
      const data = result.data && typeof result.data === "object" ? result.data as unknown as Record<string, unknown> : {};
      const vid = data.vid;
      if (vid === undefined || vid === null) {
        return toolResult({ ...result, data: { ...data, verification: { outcome: "unknown", warnings: ["DSL create response did not include a verifiable vid"] } } }, false);
      }
      const linkHint = [data.fill_url, data.fillUrl, data.pc_path, data.pcPath, data.mobile_path, data.mobilePath, data.sid]
        .find((value): value is string => typeof value === "string" && value.trim().length > 0);
      const verification = await verifyWjxDslWrite({ vid: vid as string | number, expectedDsl: args.dsl, ...(linkHint ? { linkHint } : {}) });
      return toolResult({ ...result, data: { ...data, verification } }, false);
    } catch (error) { return toolError(error); }
  });

  server.registerTool("update_survey_from_definition", {
    title: "使用 DSL 定义修改问卷",
    description: "接收传统 vid 和 AI 生成的修改后完整 DSL，校验通过后调用 A1000110，并读回 DSL、状态和结构验证写入。后端负责 Diff、Topic 重排、逻辑引用和答卷保护。",
    inputSchema: {
      vid: vidSchema,
      dsl: dslSchema,
      allow_breaking_changes: z.boolean().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true, title: "使用 DSL 定义修改问卷" },
  }, async (args) => {
    try {
      const before = await queryWjxDsl({ vid: args.vid, get_questions: true, get_items: true });
      if (before.result !== true) return toolApiResult(before);
      const result = await updateWjxDsl({ vid: args.vid, dsl: args.dsl, ...(args.allow_breaking_changes === undefined ? {} : { allowBreakingChanges: args.allow_breaking_changes }) });
      assertApiResponse(result);
      if (result.result !== true) return toolApiResult(result);
      const verification = await verifyWjxDslWrite({ vid: args.vid, expectedDsl: args.dsl });
      const data = result.data && typeof result.data === "object" ? result.data as unknown as Record<string, unknown> : {};
      return toolResult({ ...result, data: { ...data, verification } }, false);
    } catch (error) { return toolError(error); }
  });
}
