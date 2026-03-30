import type { WjxCredentials } from "wjx-api-sdk";
import { CliError } from "./errors.js";

export function getCredentials(globalOpts: { token?: string }): WjxCredentials {
  const token = globalOpts.token || process.env.WJX_TOKEN;
  if (!token) {
    throw new CliError(
      "AUTH_ERROR",
      "WJX_TOKEN 未设置。请通过 --token 参数或 WJX_TOKEN 环境变量提供。",
    );
  }
  return { token };
}
