import { Command } from "commander";
import { createInterface } from "node:readline/promises";
import { stdin, stderr } from "node:process";
import { getWjxBaseUrl, listSurveys } from "wjx-api-sdk";
import { loadConfig, saveConfig, getConfigPath } from "../lib/config.js";
import { maskApiKey } from "../lib/mask.js";
import { installSkill } from "../lib/install-skill.js";
import { installPptSkill } from "../lib/install-ppt-skill.js";
import { resolveInstallRoot } from "../lib/install-root.js";
import { formatOutput } from "../lib/output.js";
import { CliError } from "../lib/errors.js";
import { getMerged } from "../lib/command-helpers.js";
import type { WjxConfig } from "../lib/config.js";

const DEFAULT_BASE_URL = "https://www.wjx.cn";
const API_KEY_LOGIN_PATH = "/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1";

function nonBlank(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function buildApiKeyLoginUrl(baseUrl: string): string {
  return `${getWjxBaseUrl(baseUrl)}${API_KEY_LOGIN_PATH}`;
}

/** Validate API Key by calling listSurveys. Failed validation aborts init. */
async function validateApiKey(apiKey: string, baseUrl?: string): Promise<void> {
  try {
    const result = await listSurveys(
      { page_index: 1, page_size: 1 },
      { apiKey },
      fetch,
      baseUrl ? { baseUrl } : undefined,
    );
    if (result.result === false) {
      throw new CliError("AUTH_ERROR", `API Key 验证失败: ${result.errormsg || "API 请求被拒绝"}`, {
        ...(result.errorcode !== undefined ? { errorcode: result.errorcode } : {}),
        ...(result.traceid !== undefined ? { traceid: result.traceid } : {}),
      });
    }
    if (result.result !== true) {
      throw new CliError("API_ERROR", "API Key 验证响应格式无效：缺少布尔 result 字段");
    }
  } catch (err) {
    if (err instanceof CliError) throw err;
    throw new CliError("API_ERROR", `API Key 验证请求失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Save config without emitting partial success output. */
function saveConfigValues(apiKey: string, baseUrl: string, corpId: string | undefined): void {
  const newConfig: WjxConfig = { apiKey };
  if (baseUrl !== DEFAULT_BASE_URL) newConfig.baseUrl = baseUrl;
  if (corpId) newConfig.corpId = corpId;
  saveConfig(newConfig);
}

/**
 * Non-interactive init: wjx init --api-key <key> [--base-url <url>] [--corp-id <id>]
 *
 * 参数模式视为脚本/AI Agent 自动化场景。`opts.installSkill` 默认 true（核心 cli-use），
 * `opts.installPptSkill` 默认 false（PPT 报告 skill，会触发 ~30MB pip 安装，opt-in）。
 * 调用方可通过 `--no-install-skill` 关闭核心安装、`--install-ppt-skill` 显式启用 PPT。
 */
async function initWithArgs(opts: {
  apiKey: string;
  baseUrl?: string;
  corpId?: string;
  installSkill: boolean;
  installPptSkill?: boolean;
  targetDir?: string;
}): Promise<void> {
  const apiKey = opts.apiKey.trim();
  if (!apiKey) throw new CliError("INPUT_ERROR", "API Key 不能为空");
  const baseUrl = nonBlank(opts.baseUrl) ?? nonBlank(process.env.WJX_BASE_URL) ?? DEFAULT_BASE_URL;
  const corpId = nonBlank(opts.corpId) ?? nonBlank(process.env.WJX_CORP_ID);

  await validateApiKey(apiKey, baseUrl);
  const messages: string[] = [];

  if (opts.installSkill) {
    const { root, source } = resolveInstallRoot({ targetDir: opts.targetDir });
    const result = installSkill(root, { force: true, silent: true, rootSource: source });
    if (result.status === "error") {
      throw new CliError("INPUT_ERROR", `技能安装失败: ${result.message}`, { config_path: getConfigPath() });
    }
    messages.push(result.message);
  }
  if (opts.installPptSkill) {
    const { root, source } = resolveInstallRoot({ targetDir: opts.targetDir });
    const result = installPptSkill(root, { force: true, silent: true, rootSource: source });
    if (result.status === "error" || result.status === "partial") {
      throw new CliError("INPUT_ERROR", `wjx-survey-ppt 技能安装失败: ${result.message}`, { config_path: getConfigPath(), status: result.status });
    }
    messages.push(`wjx-survey-ppt: ${result.message}`);
  }
  saveConfigValues(apiKey, baseUrl, corpId);
  stderr.write("验证 API Key... OK\n");
  stderr.write(`已保存到 ${getConfigPath()}\n`);
  for (const message of messages) stderr.write(`${message}\n`);
}

/**
 * Interactive init wizard.
 *
 * 普通用户（人工敲命令）走这条路径。结束后会问两个 y/n：
 *   1. 是否装 wjx-cli-use + wjx-cli-expert 子 Agent（默认 Y，核心使用面）
 *   2. 是否装 wjx-survey-ppt 技能（默认 N，opt-in，会触发 ~30MB pip 安装）
 * AI Agent 自动化走 `wjx init --api-key <key> [--install-ppt-skill]` 参数模式。
 */
async function initInteractive(opts: { targetDir?: string } = {}): Promise<void> {
  const config = loadConfig();
  const currentApiKey = nonBlank(process.env.WJX_API_KEY) ?? nonBlank(config?.apiKey) ?? "";
  const currentBaseUrl = nonBlank(process.env.WJX_BASE_URL) ?? nonBlank(config?.baseUrl) ?? "";
  const currentCorpId = nonBlank(process.env.WJX_CORP_ID) ?? nonBlank(config?.corpId) ?? "";

  stderr.write("问卷星 CLI 配置向导\n");
  stderr.write(`配置文件: ${getConfigPath()}\n\n`);

  const rl = createInterface({ input: stdin, output: stderr });
  try {
    // 1. API Key (required *)
    let apiKey = "";
    while (!apiKey) {
      const hint = currentApiKey ? ` [${maskApiKey(currentApiKey)}]` : "";
      if (!currentApiKey) {
        stderr.write("获取 API Key：微信扫码登录下方链接，登录后页面会显示你的 API Key。\n");
        stderr.write(`${buildApiKeyLoginUrl(currentBaseUrl || DEFAULT_BASE_URL)}\n\n`);
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

    await validateApiKey(apiKey, baseUrl);
    const messages: string[] = [];

    // ── 询问 1：cli-use 技能 + wjx-cli-expert 子 Agent（默认 Y，核心使用面） ──
    stderr.write("\n");
    const ans1 = (await rl.question(
      "安装 wjx-cli-use 技能 + wjx-cli-expert 子 Agent？\n" +
        "  装到 ./skills/wjx-cli-use/、./.claude/skills/wjx-cli-use/ + ./.claude/agents/wjx-cli-expert.md\n" +
        "  AI Agent 用它来自动操作问卷星 [Y/n]: ",
    )).trim().toLowerCase();
    if (ans1 !== "n" && ans1 !== "no") {
      const { root, source } = resolveInstallRoot({ targetDir: opts.targetDir });
      const r = installSkill(root, { force: true, silent: true, rootSource: source });
      if (r.status === "error") throw new CliError("INPUT_ERROR", `技能安装失败: ${r.message}`, { config_path: getConfigPath() });
      messages.push(r.message);
    } else {
      stderr.write("已跳过。后续可运行：wjx skill install\n");
    }

    // ── 询问 2：wjx-survey-ppt 技能（默认 N，opt-in） ──
    stderr.write("\n");
    const ans2 = (await rl.question(
      "安装 wjx-survey-ppt 技能（问卷答卷 → PPT 报告）？\n" +
        "  会同时 pip 安装 ppt-master-survey + jieba（约 30MB）\n" +
        "  适合需要把问卷数据自动出 PPT 报告的场景 [y/N]: ",
    )).trim().toLowerCase();
    if (ans2 === "y" || ans2 === "yes") {
      const { root, source } = resolveInstallRoot({ targetDir: opts.targetDir });
      const r = installPptSkill(root, { force: true, silent: true, rootSource: source });
      if (r.status === "error" || r.status === "partial") throw new CliError("INPUT_ERROR", `wjx-survey-ppt 技能安装失败: ${r.message}`, { config_path: getConfigPath(), status: r.status });
      messages.push(`wjx-survey-ppt: ${r.message}`);
    } else {
      stderr.write("已跳过。后续可运行：wjx skill install-ppt\n");
    }

    saveConfigValues(apiKey, baseUrl, corpId);
    stderr.write("验证 API Key... OK\n\n");
    stderr.write(`已保存到 ${getConfigPath()}\n`);
    stderr.write("提示: 也可以直接编辑该文件修改配置（如 WJX_CORP_ID 通讯录）。\n");
    for (const message of messages) stderr.write(`${message}\n`);
  } finally {
    rl.close();
  }
}

export function registerInitCommands(program: Command): void {
  program
    .command("init")
    .description("初始化配置（交互式向导，或 --api-key 参数模式跳过交互）")
    .option("--base-url <url>", "Base URL")
    .option("--corp-id <id>", "Corp ID")
    .option("--no-install-skill", "跳过 wjx-cli-use 技能安装（仅参数模式生效）")
    .option("--install-ppt-skill", "同时安装 wjx-survey-ppt 技能（仅参数模式生效；触发 ~30MB pip 装包）")
    .option(
      "--target-dir <path>",
      "技能安装根目录（不传时按 WJX_INSTALL_ROOT → 已知客户端环境变量 → cwd 解析）",
    )
    .action(async (_opts: {
      baseUrl?: string;
      corpId?: string;
      installSkill: boolean;
      installPptSkill?: boolean;
      targetDir?: string;
    }, cmd: Command) => {
      const merged = getMerged(cmd);
      const input = {
        baseUrl: merged.baseUrl as string | undefined,
        corpId: merged.corpId as string | undefined,
        installSkill: merged.installSkill === undefined ? true : merged.installSkill === true,
        installPptSkill: merged.installPptSkill === true,
        targetDir: merged.targetDir as string | undefined,
      };
      // --api-key is a global option on the root program; read from parent
      const apiKeyOption = cmd.parent?.opts().apiKey as unknown;

      if (apiKeyOption !== undefined) {
        if (program.opts().dryRun) {
          formatOutput({
            kind: "dry-run",
            plans: [],
            input: {
              apiKey: "****",
              baseUrl: input.baseUrl || DEFAULT_BASE_URL,
              corpId: input.corpId,
              installSkill: input.installSkill,
              installPptSkill: input.installPptSkill,
              targetDir: input.targetDir,
            },
            note: "初始化是本地配置写入操作，dry-run 不验证 API、不写配置、不安装技能",
          }, program.opts());
          return;
        }
        // 参数模式：直接配置，不弹交互
        await initWithArgs({ apiKey: String(apiKeyOption), ...input });
        return;
      }

      // 非 TTY 且无 --api-key：无法交互
      if (!stdin.isTTY) {
        const config = loadConfig();
        if (config?.apiKey) {
          stderr.write(`已有配置 (${getConfigPath()})，API Key: ${maskApiKey(config.apiKey)}\n`);
          stderr.write("如需更新，请使用参数模式: wjx init --api-key <key>\n");
          return;
        }
        throw new CliError(
          "AUTH_ERROR",
          "非交互环境下缺少 API Key，请使用参数模式: wjx init --api-key <key> [--base-url <url>] [--corp-id <id>]",
        );
      }

      // 交互模式
      await initInteractive({ targetDir: input.targetDir });
    });
}
