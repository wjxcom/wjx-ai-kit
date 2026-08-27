import type { WjxCredentials } from "wjx-api-sdk";
import { CliError } from "./errors.js";
import { resolveProfile } from "./profiles.js";
import { getCredentialProvider } from "./credential-provider.js";

export function getCredentials(globalOpts: { apiKey?: string; profile?: string }): WjxCredentials {
  try {
    const profile = resolveProfile({ profile: globalOpts.profile });
    if (profile.baseUrl && !process.env.WJX_BASE_URL) process.env.WJX_BASE_URL = profile.baseUrl;
    if (profile.corpId && !process.env.WJX_CORP_ID) process.env.WJX_CORP_ID = profile.corpId;
    if (globalOpts.apiKey) return { apiKey: globalOpts.apiKey };
    return getCredentialProvider().get(profile, "user");
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(
      "AUTH_ERROR",
      error instanceof Error ? error.message : "WJX_API_KEY 未设置。请通过 --api-key 参数、WJX_API_KEY 环境变量、或运行 wjx init 配置。",
    );
  }
}
