import { getWjxApiUrl } from "wjx-api-sdk";
import { CliError } from "./errors.js";
import { resolveProfile } from "./profiles.js";
import { getCredentialProvider } from "./credential-provider.js";
function profileString(profile, key) {
    const value = profile[key];
    if (typeof value !== "string" || !value.trim())
        return undefined;
    const trimmed = value.trim().replace(/\/+$/, "");
    // Profiles are documented as deployment hosts. Be forgiving if a caller
    // copied an OpenAPI endpoint into the field, avoiding a duplicated path.
    try {
        const parsed = new URL(trimmed);
        if (/^\/openapi\/[^/]+\.aspx$/i.test(parsed.pathname))
            return parsed.origin;
    }
    catch {
        // The SDK will surface a useful URL/fetch error for malformed values.
    }
    return trimmed;
}
export function getProfileApiUrl(profile) {
    const baseUrl = profileString(profile, "baseUrl");
    return baseUrl ? getWjxApiUrl(baseUrl) : undefined;
}
export function getProfileBaseUrl(profile) {
    return profileString(profile, "baseUrl");
}
/** Add profile-only routing defaults without mutating process-wide state. */
export function applyProfileDefaults(input, profile) {
    const corpId = profile.corpId;
    if (Object.prototype.hasOwnProperty.call(input, "corpid") && input.corpid === undefined && typeof corpId === "string" && corpId.trim()) {
        return { ...input, corpid: corpId.trim() };
    }
    return input;
}
export function applyProfileCredentials(credentials, profile) {
    const baseUrl = profileString(profile, "baseUrl");
    const corpId = typeof profile.corpId === "string" && profile.corpId.trim() ? profile.corpId.trim() : undefined;
    return {
        ...credentials,
        ...(baseUrl ? { baseUrl } : {}),
        ...(corpId ? { corpId } : {}),
    };
}
export function getCredentials(globalOpts) {
    try {
        const profile = resolveProfile({ profile: globalOpts.profile });
        const credentials = globalOpts.apiKey ? { apiKey: globalOpts.apiKey } : getCredentialProvider().get(profile, "user");
        return applyProfileCredentials(credentials, profile);
    }
    catch (error) {
        if (error instanceof CliError)
            throw error;
        throw new CliError("AUTH_ERROR", error instanceof Error ? error.message : "WJX_API_KEY 未设置。请通过 --api-key 参数、WJX_API_KEY 环境变量、或运行 wjx init 配置。");
    }
}
//# sourceMappingURL=auth.js.map