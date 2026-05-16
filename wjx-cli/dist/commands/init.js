import { createInterface } from "node:readline/promises";
import { stdin, stderr } from "node:process";
import { listSurveys } from "wjx-api-sdk";
import { loadConfig, saveConfig, CONFIG_PATH } from "../lib/config.js";
import { maskApiKey } from "../lib/mask.js";
import { installSkill } from "../lib/install-skill.js";
import { installPptSkill } from "../lib/install-ppt-skill.js";
import { resolveInstallRoot } from "../lib/install-root.js";
const DEFAULT_BASE_URL = "https://www.wjx.cn";
/** Validate API Key by calling listSurveys. Returns true if valid. */
async function validateApiKey(apiKey) {
    stderr.write("验证 API Key...");
    try {
        const result = await listSurveys({ page_index: 1, page_size: 1 }, { apiKey });
        if (result.result === false) {
            stderr.write(` 失败 (${result.errormsg})\n`);
            stderr.write("  配置仍将保存，请检查 Key 是否正确。\n");
            return false;
        }
        stderr.write(" OK\n");
        return true;
    }
    catch (err) {
        stderr.write(` 失败 (${err instanceof Error ? err.message : String(err)})\n`);
        stderr.write("  配置仍将保存。\n");
        return false;
    }
}
/** Save config and print confirmation. */
function saveAndReport(apiKey, baseUrl, corpId) {
    const newConfig = { apiKey };
    if (baseUrl !== DEFAULT_BASE_URL)
        newConfig.baseUrl = baseUrl;
    if (corpId)
        newConfig.corpId = corpId;
    saveConfig(newConfig);
    stderr.write(`已保存到 ${CONFIG_PATH}\n`);
}
/**
 * Non-interactive init: wjx init --api-key <key> [--base-url <url>] [--corp-id <id>]
 *
 * 参数模式视为脚本/AI Agent 自动化场景。`opts.installSkill` 默认 true（核心 cli-use），
 * `opts.installPptSkill` 默认 false（PPT 报告 skill，会触发 ~30MB pip 安装，opt-in）。
 * 调用方可通过 `--no-install-skill` 关闭核心安装、`--install-ppt-skill` 显式启用 PPT。
 */
async function initWithArgs(opts) {
    const apiKey = opts.apiKey;
    const baseUrl = opts.baseUrl || DEFAULT_BASE_URL;
    const corpId = opts.corpId || undefined;
    // Apply base URL for validation
    if (baseUrl !== DEFAULT_BASE_URL) {
        process.env.WJX_BASE_URL = baseUrl;
    }
    else {
        delete process.env.WJX_BASE_URL;
    }
    await validateApiKey(apiKey);
    saveAndReport(apiKey, baseUrl, corpId);
    if (opts.installSkill) {
        const { root, source } = resolveInstallRoot({ targetDir: opts.targetDir });
        const result = installSkill(root, { force: true, rootSource: source });
        if (result.status === "error") {
            stderr.write(`技能安装失败: ${result.message}\n`);
        }
    }
    if (opts.installPptSkill) {
        const { root, source } = resolveInstallRoot({ targetDir: opts.targetDir });
        const result = installPptSkill(root, { force: true, rootSource: source });
        if (result.status === "error") {
            stderr.write(`wjx-survey-ppt 技能安装失败: ${result.message}\n`);
        }
    }
}
/**
 * Interactive init wizard.
 *
 * 普通用户（人工敲命令）走这条路径。结束后会问两个 y/n：
 *   1. 是否装 wjx-cli-use + wjx-cli-expert 子 Agent（默认 Y，核心使用面）
 *   2. 是否装 wjx-survey-ppt 技能（默认 N，opt-in，会触发 ~30MB pip 安装）
 * AI Agent 自动化走 `wjx init --api-key <key> [--install-ppt-skill]` 参数模式。
 */
async function initInteractive(opts = {}) {
    const config = loadConfig();
    const currentApiKey = process.env.WJX_API_KEY || config?.apiKey || "";
    const currentBaseUrl = process.env.WJX_BASE_URL || config?.baseUrl || "";
    const currentCorpId = process.env.WJX_CORP_ID || config?.corpId || "";
    stderr.write("问卷星 CLI 配置向导\n");
    stderr.write(`配置文件: ${CONFIG_PATH}\n\n`);
    const rl = createInterface({ input: stdin, output: stderr });
    try {
        // 1. API Key (required *)
        let apiKey = "";
        while (!apiKey) {
            const hint = currentApiKey ? ` [${maskApiKey(currentApiKey)}]` : "";
            if (!currentApiKey) {
                stderr.write("获取 API Key：微信扫码登录下方链接，登录后页面会显示你的 API Key。\n");
                stderr.write("https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1\n\n");
            }
            const input = await rl.question(`* WJX_API_KEY${hint}: `);
            apiKey = input.trim() || currentApiKey;
            if (!apiKey) {
                stderr.write("  API Key 不能为空，请输入。\n");
            }
        }
        // 2. Base URL (optional)
        const defaultUrl = currentBaseUrl || DEFAULT_BASE_URL;
        const baseUrlInput = await rl.question(`  WJX_BASE_URL [${defaultUrl}]: `);
        const baseUrl = baseUrlInput.trim() || defaultUrl;
        // 3. Corp ID (保留已有值，不再默认询问以简化向导；如需配置请直接编辑 ~/.wjxrc)
        const corpId = currentCorpId || undefined;
        // Apply base URL before validation so SDK uses the correct endpoint
        if (baseUrl !== DEFAULT_BASE_URL) {
            process.env.WJX_BASE_URL = baseUrl;
        }
        else {
            delete process.env.WJX_BASE_URL;
        }
        await validateApiKey(apiKey);
        stderr.write("\n");
        saveAndReport(apiKey, baseUrl, corpId);
        stderr.write("提示: 也可以直接编辑该文件修改配置（如 WJX_CORP_ID 通讯录）。\n");
        // ── 询问 1：cli-use 技能 + wjx-cli-expert 子 Agent（默认 Y，核心使用面） ──
        stderr.write("\n");
        const ans1 = (await rl.question("安装 wjx-cli-use 技能 + wjx-cli-expert 子 Agent？\n" +
            "  装到 ./skills/wjx-cli-use/ + ./.claude/agents/wjx-cli-expert.md\n" +
            "  AI Agent 用它来自动操作问卷星 [Y/n]: ")).trim().toLowerCase();
        if (ans1 !== "n" && ans1 !== "no") {
            const { root, source } = resolveInstallRoot({ targetDir: opts.targetDir });
            const r = installSkill(root, { force: true, rootSource: source });
            if (r.status === "error")
                stderr.write(`安装失败: ${r.message}\n`);
        }
        else {
            stderr.write("已跳过。后续可运行：wjx skill install\n");
        }
        // ── 询问 2：wjx-survey-ppt 技能（默认 N，opt-in） ──
        stderr.write("\n");
        const ans2 = (await rl.question("安装 wjx-survey-ppt 技能（问卷答卷 → PPT 报告）？\n" +
            "  会同时 pip 安装 ppt-master-survey + jieba（约 30MB）\n" +
            "  适合需要把问卷数据自动出 PPT 报告的场景 [y/N]: ")).trim().toLowerCase();
        if (ans2 === "y" || ans2 === "yes") {
            const { root, source } = resolveInstallRoot({ targetDir: opts.targetDir });
            const r = installPptSkill(root, { force: true, rootSource: source });
            if (r.status === "error")
                stderr.write(`安装失败: ${r.message}\n`);
        }
        else {
            stderr.write("已跳过。后续可运行：wjx skill install-ppt\n");
        }
    }
    finally {
        rl.close();
    }
}
export function registerInitCommands(program) {
    program
        .command("init")
        .description("初始化配置（交互式向导，或 --api-key 参数模式跳过交互）")
        .option("--base-url <url>", "Base URL")
        .option("--corp-id <id>", "Corp ID")
        .option("--no-install-skill", "跳过 wjx-cli-use 技能安装（仅参数模式生效）")
        .option("--install-ppt-skill", "同时安装 wjx-survey-ppt 技能（仅参数模式生效；触发 ~30MB pip 装包）")
        .option("--target-dir <path>", "技能安装根目录（不传时按 WJX_INSTALL_ROOT → 已知客户端环境变量 → cwd 解析）")
        .action(async (opts, cmd) => {
        // --api-key is a global option on the root program; read from parent
        const apiKey = cmd.parent?.opts().apiKey;
        if (apiKey) {
            // 参数模式：直接配置，不弹交互
            await initWithArgs({ apiKey, ...opts });
            return;
        }
        // 非 TTY 且无 --api-key：无法交互
        if (!stdin.isTTY) {
            const config = loadConfig();
            if (config?.apiKey) {
                stderr.write(`已有配置 (${CONFIG_PATH})，API Key: ${maskApiKey(config.apiKey)}\n`);
                stderr.write("如需更新，请使用参数模式: wjx init --api-key <key>\n");
                return;
            }
            stderr.write("非交互环境下请使用参数模式:\n");
            stderr.write("  wjx init --api-key <key> [--base-url <url>] [--corp-id <id>]\n");
            process.exitCode = 1;
            return;
        }
        // 交互模式
        await initInteractive({ targetDir: opts.targetDir });
    });
}
//# sourceMappingURL=init.js.map