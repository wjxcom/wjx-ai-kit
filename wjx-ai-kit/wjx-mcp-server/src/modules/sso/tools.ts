import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  buildSsoSubaccountUrl,
  buildSsoUserSystemUrl,
  buildSsoPartnerUrl,
  buildSurveyUrl,
  buildPreviewUrl,
} from "./client.js";
import { toolResult, toolError } from "../../helpers.js";

export function registerSsoTools(server: McpServer): void {
  // ─── sso_subaccount_url ───────────────────────────────────────────
  server.registerTool(
    "sso_subaccount_url",
    {
      title: "生成子账号SSO登录链接",
      description:
        "生成子账号单点登录（SSO）链接，用于子账号免密登录或自动创建子账号。",
      inputSchema: {
        subuser: z.string().min(1).describe("子账号用户名"),
        mobile: z.string().optional().describe("手机号"),
        email: z.string().optional().describe("邮箱"),
        role_id: z
          .number()
          .int()
          .min(1)
          .max(4)
          .optional()
          .describe("角色 ID（1-4）"),
        url: z.string().optional().describe("登录后跳转地址"),
        admin: z
          .number()
          .int()
          .min(0)
          .max(1)
          .optional()
          .describe("设为 1 时以主账号身份登录"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        title: "生成子账号SSO登录链接",
      },
    },
    async (args) => {
      try {
        const url = buildSsoSubaccountUrl({
          subuser: args.subuser,
          mobile: args.mobile,
          email: args.email,
          role_id: args.role_id,
          url: args.url,
          admin: args.admin,
        });
        return toolResult({ result: true, url }, false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── sso_user_system_url ──────────────────────────────────────────
  server.registerTool(
    "sso_user_system_url",
    {
      title: "生成用户系统SSO链接",
      description:
        "生成用户系统参与者的单点登录（SSO）链接，用于用户系统中的成员免密登录。",
      inputSchema: {
        u: z.string().min(1).describe("账户用户名"),
        user_system: z
          .number()
          .int()
          .default(1)
          .describe("用户系统标志（固定为 1）"),
        system_id: z.number().int().describe("用户系统 ID"),
        uid: z.string().min(1).describe("参与者 ID"),
        uname: z.string().optional().describe("参与者姓名"),
        udept: z.string().optional().describe("参与者部门"),
        uextf: z.string().optional().describe("扩展字段"),
        upass: z.string().optional().describe("密码"),
        is_login: z
          .number()
          .int()
          .min(0)
          .max(1)
          .optional()
          .describe("是否登录（0 或 1）"),
        activity: z
          .number()
          .int()
          .optional()
          .describe("跳转到的问卷编号"),
        return_url: z.string().optional().describe("返回地址"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        title: "生成用户系统SSO链接",
      },
    },
    async (args) => {
      try {
        const url = buildSsoUserSystemUrl({
          u: args.u,
          user_system: args.user_system,
          system_id: args.system_id,
          uid: args.uid,
          uname: args.uname,
          udept: args.udept,
          uextf: args.uextf,
          upass: args.upass,
          is_login: args.is_login,
          activity: args.activity,
          return_url: args.return_url,
        });
        return toolResult({ result: true, url }, false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── sso_partner_url ──────────────────────────────────────────────
  server.registerTool(
    "sso_partner_url",
    {
      title: "生成合作伙伴SSO登录链接",
      description:
        "生成合作伙伴/代理商的单点登录（SSO）链接，用于合作伙伴免密登录。",
      inputSchema: {
        username: z.string().min(1).describe("合作伙伴账号用户名"),
        mobile: z.string().optional().describe("手机号"),
        subuser: z.string().optional().describe("子账号用户名"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        title: "生成合作伙伴SSO登录链接",
      },
    },
    async (args) => {
      try {
        const url = buildSsoPartnerUrl({
          username: args.username,
          mobile: args.mobile,
          subuser: args.subuser,
        });
        return toolResult({ result: true, url }, false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── build_survey_url ─────────────────────────────────────────────
  server.registerTool(
    "build_survey_url",
    {
      title: "生成问卷创建/编辑链接",
      description:
        "生成快速创建或编辑问卷的 URL（无需签名）。创建模式生成空白问卷链接，编辑模式生成问卷编辑器链接（需提供 activity 问卷编号）。",
      inputSchema: {
        mode: z
          .enum(["create", "edit"])
          .describe("模式：create=创建, edit=编辑"),
        name: z
          .string()
          .optional()
          .describe("问卷名称（仅创建模式）"),
        qt: z
          .number()
          .int()
          .optional()
          .describe("问卷类型（仅创建模式）"),
        osa: z
          .number()
          .int()
          .optional()
          .describe("设为 1 自动发布（仅创建模式）"),
        redirect_url: z.string().optional().describe("操作后跳转地址"),
        activity: z
          .number()
          .int()
          .optional()
          .describe("问卷编号（编辑模式必填）"),
        editmode: z
          .number()
          .int()
          .optional()
          .describe("编辑模式（仅编辑模式）"),
        runprotect: z
          .number()
          .int()
          .optional()
          .describe("运行保护标志（仅编辑模式）"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        title: "生成问卷创建/编辑链接",
      },
    },
    async (args) => {
      try {
        const url = buildSurveyUrl({
          mode: args.mode,
          name: args.name,
          qt: args.qt,
          osa: args.osa,
          redirect_url: args.redirect_url,
          activity: args.activity,
          editmode: args.editmode,
          runprotect: args.runprotect,
        });
        return toolResult({ result: true, url }, false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── build_preview_url ────────────────────────────────────────────
  server.registerTool(
    "build_preview_url",
    {
      title: "生成问卷预览链接",
      description:
        "生成问卷预览链接（无需签名），可在浏览器中预览问卷效果。创建问卷后推荐使用此工具返回预览地址。",
      inputSchema: {
        vid: z.number().int().positive().describe("问卷编号"),
        source: z
          .string()
          .optional()
          .describe("来源标识（可选，用于追踪）"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        title: "生成问卷预览链接",
      },
    },
    async (args) => {
      try {
        const url = buildPreviewUrl({
          vid: args.vid,
          source: args.source,
        });
        return toolResult({ result: true, url }, false);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
