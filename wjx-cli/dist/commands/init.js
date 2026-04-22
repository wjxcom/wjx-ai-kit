import { createInterface } from "node:readline/promises";
import { stdin, stderr } from "node:process";
import { listSurveys } from "wjx-api-sdk";
import { loadConfig, saveConfig, CONFIG_PATH } from "../lib/config.js";
import { maskApiKey } from "../lib/mask.js";
import { installSkill } from "../lib/install-skill.js";
const DEFAULT_BASE_URL = "https://www.wjx.cn";
/**
 * Detect AI Agent environment. 仅在 AI 场景下提示安装技能。
 *
 * 策略：
 * 1. 高置信度厂商变量（官方文档或已观察到的会注入到子进程环境）
 * 2. 通用 opt-in 变量 WJX_AGENT/AI_AGENT —— 文档中约定"未知 agent 请在启动配置注入 WJX_AGENT=1"
 * 3. 避免依赖 VSCODE_PID/TERM_PROGRAM 这类过宽信号（普通 VS Code 终端会误触发）
 */
function isAiAgentEnv() {
    const KNOWN_AI_ENV_VARS = [
        // Anthropic
        "CLAUDECODE",
        "CLAUDE_CODE",
        "CLAUDE_CODE_ENTRYPOINT",
        "CLAUDE_CODE_SSE_PORT",
        // Cursor
        "CURSOR_AGENT",
        "CURSOR_TRACE_ID",
        // Windsurf / Codeium
        "CODEIUM_API_KEY",
        "WINDSURF_SESSION",
        "WINDSURF",
        // Cline / Continue / Aider / Codex
        "CLINE_AGENT",
        "CONTINUE_GLOBAL_DIR",
        "AIDER_MODEL",
        "CODEX_AGENT",
        "OPENAI_CODEX",
        // 字节 Trae / 阿里 Qoder / 通义灵码 / 腾讯 WorkBuddy·CodeBuddy
        "TRAE_AGENT",
        "QODER_AGENT",
        "LINGMA_AGENT",
        "CODEBUDDY_AGENT",
        "WORKBUDDY_AGENT",
        // Manus
        "MANUS_AGENT",
        // Claw 家族（OpenClaw / KimiClaw / QClaw / LinClaw / MaxClaw / EasyClaw / ArkClaw / DuClaw）
        "OPENCLAW",
        "OPENCLAW_GATEWAY_TOKEN",
        "CLAW_AGENT",
        // 通用 opt-in（未识别的 agent 可通过设置此变量启用 AI 行为）
        "AI_AGENT",
        "WJX_AGENT",
    ];
    return KNOWN_AI_ENV_VARS.some((name) => Boolean(process.env[name]));
}
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
/** Non-interactive init: wjx init --api-key <key> [--base-url <url>] [--corp-id <id>] */
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
    if (opts.installSkill && isAiAgentEnv()) {
        const result = installSkill(process.cwd(), { force: true });
        if (result.status === "error") {
            stderr.write(`技能安装失败: ${result.message}\n`);
        }
    }
}
/** Interactive init wizard (original behavior). */
async function initInteractive() {
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
        // 4. Skill installation — 仅在 AI Agent 场景下提示
        if (isAiAgentEnv()) {
            stderr.write("\n");
            const installAnswer = await rl.question("检测到 AI Agent 环境，推荐安装 wjx-cli-use 技能以获取完整体验？(y/n) ");
            if (installAnswer.trim().toLowerCase() === "y") {
                const result = installSkill(process.cwd(), { force: true });
                if (result.status === "error") {
                    stderr.write(`技能安装失败: ${result.message}\n`);
                }
            }
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
        .option("--no-install-skill", "跳过技能安装（参数模式下默认安装）")
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
        await initInteractive();
    });
}
//# sourceMappingURL=init.js.map