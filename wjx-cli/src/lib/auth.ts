import {
  getWjxApiUrl,
  getWjxContactsApiUrl,
  getWjxSubuserApiUrl,
  getWjxUserSystemApiUrl,
  type WjxCredentials,
} from "wjx-api-sdk";
import { CliError } from "./errors.js";
import { resolveProfile } from "./profiles.js";
import { getCredentialProvider } from "./credential-provider.js";

function profileString(profile: { readonly baseUrl?: unknown }, key: "baseUrl"): string | undefined {
  const value = profile[key];
  if (typeof value !== "string" || !value.trim()) return undefined;
  const trimmed = value.trim().replace(/\/+$/, "");
  // Profiles are documented as deployment hosts. Be forgiving if a caller
  // copied an OpenAPI endpoint into the field, avoiding a duplicated path.
  try {
    const parsed = new URL(trimmed);
    if (/^\/openapi\/[^/]+\.aspx$/i.test(parsed.pathname)) return parsed.origin;
  } catch {
    // The SDK will surface a useful URL/fetch error for malformed values.
  }
  return trimmed;
}

export type ApiService = "default" | "user-system" | "subuser" | "contacts";

export function getProfileApiUrl(
  profile: { readonly baseUrl?: unknown },
  service: ApiService = "default",
): string | undefined {
  const baseUrl = profileString(profile, "baseUrl");
  if (!baseUrl && service === "default") return undefined;
  switch (service) {
    case "contacts": return getWjxContactsApiUrl(baseUrl);
    case "subuser": return getWjxSubuserApiUrl(baseUrl);
    case "user-system": return getWjxUserSystemApiUrl(baseUrl);
    default: return getWjxApiUrl(baseUrl);
  }
}

export function getProfileBaseUrl(profile: { readonly baseUrl?: unknown }): string | undefined {
  return profileString(profile, "baseUrl");
}

/** Add profile-only routing defaults without mutating process-wide state. */
export function applyProfileDefaults<T extends Record<string, unknown>>(
  input: T,
  profile: { readonly corpId?: unknown },
): T {
  const corpId = profile.corpId;
  if (Object.prototype.hasOwnProperty.call(input, "corpid") && input.corpid === undefined && typeof corpId === "string" && corpId.trim()) {
    return { ...input, corpid: corpId.trim() } as T;
  }
  return input;
}

export function applyProfileCredentials(
  credentials: WjxCredentials,
  profile: { readonly baseUrl?: unknown; readonly corpId?: unknown },
): WjxCredentials {
  const baseUrl = profileString(profile, "baseUrl");
  const corpId = typeof profile.corpId === "string" && profile.corpId.trim() ? profile.corpId.trim() : undefined;
  return {
    ...credentials,
    ...(baseUrl ? { baseUrl } : {}),
    ...(corpId ? { corpId } : {}),
  };
}

export function getCredentials(globalOpts: { apiKey?: string; profile?: string }): WjxCredentials {
  try {
    const profile = resolveProfile({ profile: globalOpts.profile });
    const explicitApiKey = typeof globalOpts.apiKey === "string" ? globalOpts.apiKey.trim() : "";
    if (globalOpts.apiKey !== undefined && !explicitApiKey) {
      throw new CliError("AUTH_ERROR", "WJX_API_KEY 不能为空。请通过 --api-key、环境变量或 wjx init 提供有效 Key。");
    }
    const credentials = explicitApiKey
      ? { apiKey: explicitApiKey }
      : getCredentialProvider().get(profile, "user");
    return applyProfileCredentials(credentials, profile);
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(
      "AUTH_ERROR",
      error instanceof Error ? error.message : "WJX_API_KEY 未设置。请通过 --api-key 参数、WJX_API_KEY 环境变量、或运行 wjx init 配置。",
    );
  }
}
