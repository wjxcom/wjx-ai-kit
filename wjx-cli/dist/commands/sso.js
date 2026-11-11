import { executeRuntimeAction } from "../lib/runtime/executor.js";
import { buildSsoSubaccountUrl, buildSsoUserSystemUrl, buildSsoPartnerUrl, } from "wjx-api-sdk";
import { strictInt, requireField, requireEnum, requirePositiveInt } from "../lib/command-helpers.js";
import { CliError } from "../lib/errors.js";
import { getProfileBaseUrl } from "../lib/auth.js";
import { resolveProfile } from "../lib/profiles.js";
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
        await executeRuntimeAction(program, cmd, ((input) => buildSsoSubaccountUrl(input, getProfileBaseUrl(resolveProfile({ profile: program.opts().profile })))), (m) => {
            requireField(m, "subuser");
            if (m.role_id !== undefined)
                requireEnum(m, "role_id", [1, 2, 3, 4]);
            if (m.admin !== undefined)
                requireEnum(m, "admin", [1]);
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
        .description("[已过时] 为已有用户系统参与者生成 SSO 链接")
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
        await executeRuntimeAction(program, cmd, ((input) => buildSsoUserSystemUrl(input, getProfileBaseUrl(resolveProfile({ profile: program.opts().profile })))), (m) => {
            requireField(m, "u");
            requirePositiveInt(m, "system_id");
            requireField(m, "uid");
            if (m.activity !== undefined)
                requirePositiveInt(m, "activity");
            if (m.is_login !== undefined && m.is_login !== 0 && m.is_login !== 1) {
                throw new CliError("INPUT_ERROR", "--is_login 必须是 0 或 1");
            }
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
        await executeRuntimeAction(program, cmd, ((input) => buildSsoPartnerUrl(input, getProfileBaseUrl(resolveProfile({ profile: program.opts().profile })))), (m) => {
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