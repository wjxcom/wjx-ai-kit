import { type WjxCredentials } from "wjx-api-sdk";
export declare function getProfileApiUrl(profile: {
    readonly baseUrl?: unknown;
}): string | undefined;
export declare function getProfileBaseUrl(profile: {
    readonly baseUrl?: unknown;
}): string | undefined;
/** Add profile-only routing defaults without mutating process-wide state. */
export declare function applyProfileDefaults<T extends Record<string, unknown>>(input: T, profile: {
    readonly corpId?: unknown;
}): T;
export declare function applyProfileCredentials(credentials: WjxCredentials, profile: {
    readonly baseUrl?: unknown;
    readonly corpId?: unknown;
}): WjxCredentials;
export declare function getCredentials(globalOpts: {
    apiKey?: string;
    profile?: string;
}): WjxCredentials;
