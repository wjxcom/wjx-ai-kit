import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  queryContacts,
  addContacts,
  manageContacts,
  addAdmin,
  deleteAdmin,
  restoreAdmin,
  listDepartments,
  addDepartment,
  modifyDepartment,
  deleteDepartment,
  listTags,
  addTag,
  modifyTag,
  deleteTag,
} from "./client.js";
import { toolResult, toolError } from "../../helpers.js";

export function registerContactsTools(server: McpServer): void {
  // ─── query_contacts ──────────────────────────────────────────────
  server.registerTool(
    "query_contacts",
    {
      title: "查询通讯录成员",
      description:
        "查询通讯录中的联系人成员列表，可按部门筛选并分页获取。",
      inputSchema: {
        username: z.string().min(1).describe("账户用户名"),
        dept_id: z
          .number()
          .int()
          .optional()
          .describe("部门 ID，不传则查询全部"),
        page_index: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("页码，从1开始"),
        page_size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("每页数量（1-100）"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: "查询通讯录成员",
      },
    },
    async (args) => {
      try {
        const result = await queryContacts({
          username: args.username,
          dept_id: args.dept_id,
          page_index: args.page_index,
          page_size: args.page_size,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── add_contacts ────────────────────────────────────────────────
  server.registerTool(
    "add_contacts",
    {
      title: "批量添加通讯录成员",
      description:
        "批量添加通讯录联系人。members 为 JSON 数组字符串，每个成员对象包含 name、mobile、email、dept_id、ext 等字段。",
      inputSchema: {
        username: z.string().min(1).describe("账户用户名"),
        members: z
          .string()
          .min(2)
          .refine(
            (s) => { try { return Array.isArray(JSON.parse(s)); } catch { return false; } },
            "members 必须是合法的 JSON 数组",
          )
          .describe(
            "成员列表 JSON 字符串（数组），每个对象包含 name、mobile、email、dept_id、ext 等字段",
          ),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        title: "批量添加通讯录成员",
      },
    },
    async (args) => {
      try {
        const result = await addContacts({
          username: args.username,
          members: args.members,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── manage_contacts ─────────────────────────────────────────────
  server.registerTool(
    "manage_contacts",
    {
      title: "管理通讯录成员",
      description:
        "更新或删除通讯录成员。operation 为 \"update\" 或 \"delete\"。更新时 members 为包含 id 及待修改字段的对象数组 JSON；删除时 members 为成员 ID 数组 JSON。",
      inputSchema: {
        username: z.string().min(1).describe("账户用户名"),
        operation: z
          .enum(["update", "delete"])
          .describe("操作类型：update=更新, delete=删除"),
        members: z
          .string()
          .min(2)
          .refine(
            (s) => { try { return Array.isArray(JSON.parse(s)); } catch { return false; } },
            "members 必须是合法的 JSON 数组",
          )
          .describe(
            "成员数据 JSON 字符串。更新：对象数组（含 id 及待改字段）；删除：成员 ID 数组",
          ),
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
        title: "管理通讯录成员",
      },
    },
    async (args) => {
      try {
        const result = await manageContacts({
          username: args.username,
          operation: args.operation,
          members: args.members,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── add_admin ───────────────────────────────────────────────────
  server.registerTool(
    "add_admin",
    {
      title: "添加管理员",
      description: "添加一个新的通讯录管理员，可指定手机号、邮箱和角色。",
      inputSchema: {
        username: z.string().min(1).describe("账户用户名"),
        admin_name: z.string().min(1).describe("管理员姓名"),
        mobile: z.string().optional().describe("管理员手机号"),
        email: z.string().optional().describe("管理员邮箱"),
        role: z.string().optional().describe("管理员角色"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        title: "添加管理员",
      },
    },
    async (args) => {
      try {
        const result = await addAdmin({
          username: args.username,
          admin_name: args.admin_name,
          mobile: args.mobile,
          email: args.email,
          role: args.role,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── delete_admin ────────────────────────────────────────────────
  server.registerTool(
    "delete_admin",
    {
      title: "删除管理员",
      description: "删除指定的通讯录管理员。",
      inputSchema: {
        username: z.string().min(1).describe("账户用户名"),
        admin_id: z.number().int().positive().describe("管理员 ID"),
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
        title: "删除管理员",
      },
    },
    async (args) => {
      try {
        const result = await deleteAdmin({
          username: args.username,
          admin_id: args.admin_id,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── restore_admin ───────────────────────────────────────────────
  server.registerTool(
    "restore_admin",
    {
      title: "恢复管理员",
      description: "恢复已删除的通讯录管理员。",
      inputSchema: {
        username: z.string().min(1).describe("账户用户名"),
        admin_id: z.number().int().positive().describe("管理员 ID"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: "恢复管理员",
      },
    },
    async (args) => {
      try {
        const result = await restoreAdmin({
          username: args.username,
          admin_id: args.admin_id,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── list_departments ────────────────────────────────────────────
  server.registerTool(
    "list_departments",
    {
      title: "查询部门列表",
      description: "查询通讯录中的部门列表，支持分页获取。",
      inputSchema: {
        username: z.string().min(1).describe("账户用户名"),
        page_index: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("页码，从1开始"),
        page_size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("每页数量（1-100）"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: "查询部门列表",
      },
    },
    async (args) => {
      try {
        const result = await listDepartments({
          username: args.username,
          page_index: args.page_index,
          page_size: args.page_size,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── add_department ──────────────────────────────────────────────
  server.registerTool(
    "add_department",
    {
      title: "添加部门",
      description: "添加一个新的部门，可指定父部门 ID。",
      inputSchema: {
        username: z.string().min(1).describe("账户用户名"),
        name: z.string().min(1).describe("部门名称"),
        parent_id: z.number().int().optional().describe("父部门 ID"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        title: "添加部门",
      },
    },
    async (args) => {
      try {
        const result = await addDepartment({
          username: args.username,
          name: args.name,
          parent_id: args.parent_id,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── modify_department ───────────────────────────────────────────
  server.registerTool(
    "modify_department",
    {
      title: "修改部门",
      description: "修改部门信息，可更新名称和父部门。",
      inputSchema: {
        username: z.string().min(1).describe("账户用户名"),
        dept_id: z.number().int().positive().describe("部门 ID"),
        name: z.string().min(1).optional().describe("新部门名称"),
        parent_id: z.number().int().optional().describe("新父部门 ID"),
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
        title: "修改部门",
      },
    },
    async (args) => {
      try {
        const result = await modifyDepartment({
          username: args.username,
          dept_id: args.dept_id,
          name: args.name,
          parent_id: args.parent_id,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── delete_department ───────────────────────────────────────────
  server.registerTool(
    "delete_department",
    {
      title: "删除部门",
      description: "删除指定的部门。",
      inputSchema: {
        username: z.string().min(1).describe("账户用户名"),
        dept_id: z.number().int().positive().describe("部门 ID"),
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
        title: "删除部门",
      },
    },
    async (args) => {
      try {
        const result = await deleteDepartment({
          username: args.username,
          dept_id: args.dept_id,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── list_tags ───────────────────────────────────────────────────
  server.registerTool(
    "list_tags",
    {
      title: "查询标签列表",
      description: "查询通讯录中的所有标签。",
      inputSchema: {
        username: z.string().min(1).describe("账户用户名"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
        title: "查询标签列表",
      },
    },
    async (args) => {
      try {
        const result = await listTags({
          username: args.username,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── add_tag ─────────────────────────────────────────────────────
  server.registerTool(
    "add_tag",
    {
      title: "添加标签",
      description: "添加一个新的通讯录标签。",
      inputSchema: {
        username: z.string().min(1).describe("账户用户名"),
        tag_name: z.string().min(1).describe("标签名称"),
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        title: "添加标签",
      },
    },
    async (args) => {
      try {
        const result = await addTag({
          username: args.username,
          tag_name: args.tag_name,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── modify_tag ──────────────────────────────────────────────────
  server.registerTool(
    "modify_tag",
    {
      title: "修改标签",
      description: "修改通讯录标签名称。",
      inputSchema: {
        username: z.string().min(1).describe("账户用户名"),
        tag_id: z.number().int().positive().describe("标签 ID"),
        tag_name: z.string().min(1).describe("新标签名称"),
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
        title: "修改标签",
      },
    },
    async (args) => {
      try {
        const result = await modifyTag({
          username: args.username,
          tag_id: args.tag_id,
          tag_name: args.tag_name,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  // ─── delete_tag ──────────────────────────────────────────────────
  server.registerTool(
    "delete_tag",
    {
      title: "删除标签",
      description: "删除指定的通讯录标签。",
      inputSchema: {
        username: z.string().min(1).describe("账户用户名"),
        tag_id: z.number().int().positive().describe("标签 ID"),
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
        title: "删除标签",
      },
    },
    async (args) => {
      try {
        const result = await deleteTag({
          username: args.username,
          tag_id: args.tag_id,
        });
        return toolResult(result, result.result === false);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
