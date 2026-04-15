import { z } from "zod";
import { queryContacts, addContacts, deleteContacts, addAdmin, deleteAdmin, restoreAdmin, listDepartments, addDepartment, modifyDepartment, deleteDepartment, listTags, addTag, modifyTag, deleteTag, } from "./client.js";
import { wrapToolHandler, assertJsonArray } from "../../helpers.js";
export function registerContactsTools(server) {
    // ─── query_contacts ──────────────────────────────────────────────
    server.registerTool("query_contacts", {
        title: "查询通讯录成员",
        description: "按用户编号（uid）精确查询通讯录中的指定联系人信息。注意：uid 必须完全匹配，不支持模糊搜索或通配符。corpid 可选，未提供时从 WJX_CORP_ID 环境变量获取。",
        inputSchema: {
            corpid: z.string().optional().describe("通讯录编号（可选，未提供时使用 WJX_CORP_ID 环境变量）"),
            uid: z.string().min(1).describe("用户编号（用户唯一标识）"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
            title: "查询通讯录成员",
        },
    }, wrapToolHandler(async (args) => queryContacts({
        corpid: args.corpid,
        uid: args.uid,
    })));
    // ─── add_contacts ────────────────────────────────────────────────
    server.registerTool("add_contacts", {
        title: "添加或更新通讯录成员",
        description: "批量添加或更新通讯录联系人（最多100人）。users 为 JSON 数组字符串，每个用户对象须包含 userid、name，可选 mobile、email、department、tags、birthday、gender 等。若 userid 已存在则更新。",
        inputSchema: {
            corpid: z.string().optional().describe("通讯录编号（可选，未提供时使用 WJX_CORP_ID 环境变量）"),
            users: z
                .string()
                .min(2)
                .describe("用户列表 JSON 字符串（数组），每项包含: userid(用户ID), name(姓名), nickname(昵称), mobile(手机号), email(邮箱), department(部门,用/分隔层级), tags(标签,格式:组/标签), birthday(生日), gender(性别:0保密/1男/2女), pwd(登录密码)等"),
            auto_create_udept: z.boolean().optional().describe("是否自动创建不存在的部门"),
            auto_create_tag: z.boolean().optional().describe("是否自动创建不存在的标签"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
            title: "添加或更新通讯录成员",
        },
    }, wrapToolHandler(async (args) => {
        assertJsonArray(args.users, "users");
        return addContacts({
            corpid: args.corpid,
            users: args.users,
            auto_create_udept: args.auto_create_udept,
            auto_create_tag: args.auto_create_tag,
        });
    }));
    // ─── delete_contacts ───────────────────────────────────────────
    server.registerTool("delete_contacts", {
        title: "删除通讯录成员",
        description: "从通讯录中批量删除成员。此操作不可逆，请谨慎使用！uids 为逗号分隔的用户编号列表。",
        inputSchema: {
            corpid: z.string().optional().describe("通讯录编号（可选，未提供时使用 WJX_CORP_ID 环境变量）"),
            uids: z.string().min(1).describe("用户编号列表，逗号分隔"),
        },
        annotations: {
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: true,
            title: "删除通讯录成员",
        },
    }, wrapToolHandler(async (args) => deleteContacts({
        corpid: args.corpid,
        uids: args.uids,
    })));
    // ─── add_admin ───────────────────────────────────────────────────
    server.registerTool("add_admin", {
        title: "添加或修改管理员",
        description: "批量添加或修改通讯录管理员（最多100人）。users 为 JSON 数组字符串，每个对象必须包含 userid（管理员用户ID，可在通讯录界面下查看）和 role（角色编码，必填），可选 confidential（是否保密账户）、effective_date（有效期，格式 yyyy-MM-dd）、remark（备注，最多50字）。",
        inputSchema: {
            corpid: z.string().optional().describe("通讯录编号（可选）"),
            users: z
                .string()
                .min(2)
                .describe("管理员列表 JSON 字符串（数组），每项包含: userid(管理员用户ID,必填)、role(角色,必填: 0=系统管理员, 1=分组管理员, 2=问卷管理员, 3=统计结果查看员, 4=完整结果查看员, 5=部门管理员)，可选: confidential(是否保密账户)、effective_date(有效期,格式yyyy-MM-dd)、remark(备注,最多50字)。一次不能超过100条"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
            title: "添加或修改管理员",
        },
    }, wrapToolHandler(async (args) => {
        assertJsonArray(args.users, "users");
        return addAdmin({
            corpid: args.corpid,
            users: args.users,
        });
    }));
    // ─── delete_admin ────────────────────────────────────────────────
    server.registerTool("delete_admin", {
        title: "删除管理员",
        description: "批量删除通讯录管理员。uids 为逗号分隔的管理员用户编号列表，一次不能超过100条。",
        inputSchema: {
            corpid: z.string().optional().describe("通讯录编号（可选）"),
            uids: z.string().min(1).describe("管理员用户编号列表，逗号分隔，一次最多100个"),
        },
        annotations: {
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: true,
            title: "删除管理员",
        },
    }, wrapToolHandler(async (args) => deleteAdmin({
        corpid: args.corpid,
        uids: args.uids,
    })));
    // ─── restore_admin ───────────────────────────────────────────────
    server.registerTool("restore_admin", {
        title: "恢复管理员",
        description: "批量恢复已删除的通讯录管理员。uids 为逗号分隔的管理员用户编号列表，一次不能超过100条。",
        inputSchema: {
            corpid: z.string().optional().describe("通讯录编号（可选）"),
            uids: z.string().min(1).describe("管理员用户编号列表，逗号分隔，一次最多100个"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
            title: "恢复管理员",
        },
    }, wrapToolHandler(async (args) => restoreAdmin({
        corpid: args.corpid,
        uids: args.uids,
    })));
    // ─── list_departments ────────────────────────────────────────────
    server.registerTool("list_departments", {
        title: "查询部门列表",
        description: "查询通讯录中的部门列表。",
        inputSchema: {
            corpid: z.string().optional().describe("通讯录编号（可选）"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
            title: "查询部门列表",
        },
    }, wrapToolHandler(async (args) => listDepartments({
        corpid: args.corpid,
    })));
    // ─── add_department ──────────────────────────────────────────────
    server.registerTool("add_department", {
        title: "添加部门",
        description: "批量添加部门。depts 为 JSON 数组字符串，每项为部门路径（用/分隔层级，如 \"研发部/后端\"）。",
        inputSchema: {
            corpid: z.string().optional().describe("通讯录编号（可选）"),
            depts: z
                .string()
                .min(2)
                .describe("部门路径列表 JSON 字符串，如 [\"研发部/后端\", \"产品部\"]"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
            title: "添加部门",
        },
    }, wrapToolHandler(async (args) => {
        assertJsonArray(args.depts, "depts");
        return addDepartment({
            corpid: args.corpid,
            depts: args.depts,
        });
    }));
    // ─── modify_department ───────────────────────────────────────────
    server.registerTool("modify_department", {
        title: "修改部门",
        description: "批量修改部门信息（最多100条）。depts 为 JSON 数组字符串，每项为部门对象（包含 id、name、order 等字段）。id 从 list_departments 返回值获取。",
        inputSchema: {
            corpid: z.string().optional().describe("通讯录编号（可选）"),
            depts: z
                .string()
                .min(2)
                .describe("部门列表 JSON 字符串（数组），每项包含: id(部门ID), name(部门名称), order(排序序号，须为>0且<999999的整数)，一次最多100条"),
        },
        annotations: {
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: true,
            title: "修改部门",
        },
    }, wrapToolHandler(async (args) => {
        assertJsonArray(args.depts, "depts");
        return modifyDepartment({
            corpid: args.corpid,
            depts: args.depts,
        });
    }));
    // ─── delete_department ───────────────────────────────────────────
    server.registerTool("delete_department", {
        title: "删除部门",
        description: "批量删除部门。type 指定删除方式：1=按ID删除，2=按名称删除。depts 为 JSON 数组字符串，包含要删除的部门标识列表。",
        inputSchema: {
            corpid: z.string().optional().describe("通讯录编号（可选）"),
            type: z.enum(["1", "2"]).describe("删除方式：1=按ID删除，2=按名称删除"),
            depts: z
                .string()
                .min(2)
                .describe("要删除的部门标识列表 JSON 字符串（数组），type=1时为ID列表，type=2时为名称列表"),
            del_child: z.boolean().optional().describe("是否同时删除子部门"),
        },
        annotations: {
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: true,
            title: "删除部门",
        },
    }, wrapToolHandler(async (args) => {
        assertJsonArray(args.depts, "depts");
        return deleteDepartment({
            corpid: args.corpid,
            type: args.type,
            depts: args.depts,
            del_child: args.del_child,
        });
    }));
    // ─── list_tags ───────────────────────────────────────────────────
    server.registerTool("list_tags", {
        title: "查询标签列表",
        description: "查询通讯录中的所有标签。",
        inputSchema: {
            corpid: z.string().optional().describe("通讯录编号（可选）"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
            title: "查询标签列表",
        },
    }, wrapToolHandler(async (args) => listTags({
        corpid: args.corpid,
    })));
    // ─── add_tag ─────────────────────────────────────────────────────
    server.registerTool("add_tag", {
        title: "添加标签",
        description: "批量添加通讯录标签。child_names 为 JSON 数组字符串，格式为 \"标签组/标签名\"，如 [\"学历/本科\", \"学历/硕士\"]。",
        inputSchema: {
            corpid: z.string().optional().describe("通讯录编号（可选）"),
            child_names: z
                .string()
                .min(2)
                .describe("标签列表 JSON 字符串，格式: [\"组/标签\", ...], 如 [\"学历/本科\", \"年龄/18-35\"]"),
            is_radio: z
                .boolean()
                .optional()
                .describe("标签组是否为单选（true=单选, false=多选，默认多选）"),
        },
        annotations: {
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
            title: "添加标签",
        },
    }, wrapToolHandler(async (args) => {
        assertJsonArray(args.child_names, "child_names");
        return addTag({
            corpid: args.corpid,
            child_names: args.child_names,
            is_radio: args.is_radio,
        });
    }));
    // ─── modify_tag ──────────────────────────────────────────────────
    server.registerTool("modify_tag", {
        title: "修改标签",
        description: "修改通讯录标签。可更新标签组名称(tp_name)和子标签(child_names)。tp_id 从 list_tags 返回值获取。",
        inputSchema: {
            corpid: z.string().optional().describe("通讯录编号（可选）"),
            tp_id: z.string().min(1).describe("标签组 ID（从 list_tags 获取）"),
            tp_name: z.string().optional().describe("新标签组名称"),
            child_names: z
                .string()
                .optional()
                .describe("子标签 JSON 数组字符串，每项包含标签对象（如 [{\"id\":\"xxx\",\"name\":\"新名称\"}]）"),
        },
        annotations: {
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: true,
            title: "修改标签",
        },
    }, wrapToolHandler(async (args) => {
        if (args.child_names !== undefined)
            assertJsonArray(args.child_names, "child_names");
        return modifyTag({
            corpid: args.corpid,
            tp_id: args.tp_id,
            tp_name: args.tp_name,
            child_names: args.child_names,
        });
    }));
    // ─── delete_tag ──────────────────────────────────────────────────
    server.registerTool("delete_tag", {
        title: "删除标签",
        description: "批量删除通讯录标签。type 指定删除方式：1=按ID删除，2=按名称删除。tags 为 JSON 数组字符串，包含要删除的标签标识列表。",
        inputSchema: {
            corpid: z.string().optional().describe("通讯录编号（可选）"),
            type: z.enum(["1", "2"]).describe("删除方式：1=按ID删除，2=按名称删除"),
            tags: z
                .string()
                .min(2)
                .describe("要删除的标签标识列表 JSON 字符串（数组），type=1时为ID列表，type=2时为名称列表"),
        },
        annotations: {
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: true,
            title: "删除标签",
        },
    }, wrapToolHandler(async (args) => {
        assertJsonArray(args.tags, "tags");
        return deleteTag({
            corpid: args.corpid,
            type: args.type,
            tags: args.tags,
        });
    }));
}
//# sourceMappingURL=tools.js.map