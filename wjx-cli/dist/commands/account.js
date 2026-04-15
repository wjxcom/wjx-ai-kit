import { querySubAccounts, addSubAccount, modifySubAccount, deleteSubAccount, restoreSubAccount, } from "wjx-api-sdk";
import { executeCommand, strictInt, requireField } from "../lib/command-helpers.js";
export function registerAccountCommands(program) {
    const account = program.command("account").description("子账号管理");
    // --- list ---
    account
        .command("list")
        .description("查询子账号")
        .option("--subuser <s>", "子账号用户名")
        .option("--name_like <s>", "名称模糊搜索")
        .option("--role <n>", "角色", strictInt)
        .option("--group <n>", "分组", strictInt)
        .option("--page_index <n>", "页码", strictInt)
        .option("--page_size <n>", "每页数量", strictInt)
        .option("--mobile <s>", "手机号")
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, querySubAccounts, (m) => ({
            subuser: m.subuser,
            name_like: m.name_like,
            role: m.role,
            group: m.group,
            page_index: m.page_index,
            page_size: m.page_size,
            mobile: m.mobile,
        }));
    });
    // --- add ---
    account
        .command("add")
        .description("添加子账号")
        .option("--subuser <s>", "子账号用户名")
        .option("--password <s>", "密码")
        .option("--mobile <s>", "手机号")
        .option("--email <s>", "邮箱")
        .option("--role <n>", "角色", strictInt)
        .option("--group <n>", "分组", strictInt)
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, addSubAccount, (m) => {
            requireField(m, "subuser");
            return {
                subuser: m.subuser,
                password: m.password,
                mobile: m.mobile,
                email: m.email,
                role: m.role,
                group: m.group,
            };
        });
    });
    // --- modify ---
    account
        .command("modify")
        .description("修改子账号（不支持修改密码，密码需通过问卷星后台修改）")
        .option("--subuser <s>", "子账号用户名")
        .option("--mobile <s>", "手机号")
        .option("--email <s>", "邮箱")
        .option("--role <n>", "角色", strictInt)
        .option("--group <n>", "分组", strictInt)
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, modifySubAccount, (m) => {
            requireField(m, "subuser");
            return {
                subuser: m.subuser,
                mobile: m.mobile,
                email: m.email,
                role: m.role,
                group: m.group,
            };
        });
    });
    // --- delete ---
    account
        .command("delete")
        .description("删除子账号")
        .option("--subuser <s>", "子账号用户名")
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, deleteSubAccount, (m) => {
            requireField(m, "subuser");
            return { subuser: m.subuser };
        });
    });
    // --- restore ---
    account
        .command("restore")
        .description("恢复子账号")
        .option("--subuser <s>", "子账号用户名")
        .option("--mobile <s>", "手机号")
        .option("--email <s>", "邮箱")
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, restoreSubAccount, (m) => {
            requireField(m, "subuser");
            return {
                subuser: m.subuser,
                mobile: m.mobile,
                email: m.email,
            };
        });
    });
}
//# sourceMappingURL=account.js.map