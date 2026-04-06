import { buildSsoSubaccountUrl, buildSsoUserSystemUrl, buildSsoPartnerUrl, } from "wjx-api-sdk";
import { executeCommand, strictInt, requireField } from "../lib/command-helpers.js";
export function registerSsoCommands(program) {
    const sso = program.command("sso").description("SSO 单点登录");
    // --- subaccount-url ---
    sso
        .command("subaccount-url")
        .description("生成子账号SSO登录链接")
        .option("--subuser <s>", "子账号用户名")
        .option("--mobile <s>", "手机号")
        .option("--email <s>", "邮箱")
        .option("--role_id <n>", "角色ID", strictInt)
        .option("--url <s>", "登录后跳转URL")
        .option("--admin <n>", "主账号登录(1)", strictInt)
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, buildSsoSubaccountUrl, (m) => {
            requireField(m, "subuser");
            return {
                subuser: m.subuser,
                mobile: m.mobile,
                email: m.email,
                role_id: m.role_id,
                url: m.url,
                admin: m.admin,
            };
        }, { noAuth: true });
    });
    // --- user-system-url ---
    sso
        .command("user-system-url")
        .description("生成用户系统参与者SSO链接")
        .option("--u <s>", "账号用户名")
        .option("--system_id <n>", "用户系统ID", strictInt)
        .option("--uid <s>", "参与者ID")
        .option("--uname <s>", "参与者名称")
        .option("--udept <s>", "参与者部门")
        .option("--uextf <s>", "扩展字段")
        .option("--upass <s>", "密码")
        .option("--is_login <n>", "是否登��(0/1)", strictInt)
        .option("--activity <n>", "跳转问卷vid", strictInt)
        .option("--return_url <s>", "返回URL")
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, buildSsoUserSystemUrl, (m) => {
            requireField(m, "u");
            requireField(m, "system_id");
            requireField(m, "uid");
            return {
                u: m.u,
                system_id: m.system_id,
                uid: m.uid,
                uname: m.uname,
                udept: m.udept,
                uextf: m.uextf,
                upass: m.upass,
                is_login: m.is_login,
                activity: m.activity,
                return_url: m.return_url,
            };
        }, { noAuth: true });
    });
    // --- partner-url ---
    sso
        .command("partner-url")
        .description("生成代理商SSO登录链接")
        .option("--username <s>", "代理商用户名")
        .option("--mobile <s>", "手机号")
        .option("--subuser <s>", "子账号用户名")
        .action(async (_opts, cmd) => {
        await executeCommand(program, cmd, buildSsoPartnerUrl, (m) => {
            requireField(m, "username");
            return {
                username: m.username,
                mobile: m.mobile,
                subuser: m.subuser,
            };
        }, { noAuth: true });
    });
}
//# sourceMappingURL=sso.js.map