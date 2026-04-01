import type { WjxCredentials } from "wjx-api-sdk";
import { CliError } from "./errors.js";

export function getCredentials(globalOpts: { apiKey?: string }): WjxCredentials {
  const apiKey = globalOpts.apiKey || process.env.WJX_API_KEY;
  if (!apiKey) {
    throw new CliError(
      "AUTH_ERROR",
      "WJX_API_KEY 未设置。请通过 --api-key 参数或 WJX_API_KEY 环境变量提供。",
    );
  }
  return { apiKey };
}
