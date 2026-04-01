import { Command } from "commander";
import { createInterface } from "node:readline/promises";
import { stdin, stderr } from "node:process";
import { listSurveys } from "wjx-api-sdk";
import { loadConfig, saveConfig, CONFIG_PATH } from "../lib/config.js";
import type { WjxConfig } from "../lib/config.js";

const DEFAULT_BASE_URL = "https://www.wjx.cn";

function mask(value: string): string {
  if (value.length <= 4) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

export function registerInitCommands(program: Command): void {
  program
    .command("init")
    .description("初始化配置（交互式设置 API Key、Base URL、Corp ID）")
    .action(async () => {
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
          const hint = currentApiKey ? ` [${mask(currentApiKey)}]` : "";
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

        // 3. Corp ID (optional)
        const corpHint = currentCorpId ? ` [${currentCorpId}]` : "";
        const corpIdInput = await rl.question(`  WJX_CORP_ID${corpHint}: `);
        const corpId = corpIdInput.trim() || currentCorpId || undefined;

        // Apply base URL before validation so SDK uses the correct endpoint
        if (baseUrl !== DEFAULT_BASE_URL) {
          process.env.WJX_BASE_URL = baseUrl;
        } else {
          delete process.env.WJX_BASE_URL;
        }

        // Validate API Key
        stderr.write("\n验证 API Key...");
        try {
          const result = await listSurveys(
            { page_index: 1, page_size: 1 },
            { apiKey },
          );
          if (result.result === false) {
            stderr.write(` 失败 (${result.errormsg})\n`);
            stderr.write("  配置仍将保存，请检查 Key 是否正确。\n");
          } else {
            stderr.write(" OK\n");
          }
        } catch (err) {
          stderr.write(` 失败 (${err instanceof Error ? err.message : String(err)})\n`);
          stderr.write("  配置仍将保存。\n");
        }

        // Save
        const newConfig: WjxConfig = { apiKey };
        if (baseUrl !== DEFAULT_BASE_URL) newConfig.baseUrl = baseUrl;
        if (corpId) newConfig.corpId = corpId;
        saveConfig(newConfig);

        stderr.write(`\n已保存到 ${CONFIG_PATH}\n`);
        stderr.write("提示: 也可以直接编辑该文件修改配置。\n");
      } finally {
        rl.close();
      }
    });
}
