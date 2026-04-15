import { CliError } from "./errors.js";
export function getCredentials(globalOpts) {
    const apiKey = globalOpts.apiKey || process.env.WJX_API_KEY;
    if (!apiKey) {
        throw new CliError("AUTH_ERROR", "WJX_API_KEY 未设置。请通过 --api-key 参数、WJX_API_KEY 环境变量、或运行 wjx init 配置。");
    }
    return { apiKey };
}
//# sourceMappingURL=auth.js.map