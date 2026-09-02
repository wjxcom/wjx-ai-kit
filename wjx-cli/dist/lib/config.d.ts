export interface WjxConfig {
    apiKey: string;
    baseUrl?: string;
    corpId?: string;
}
/** Resolve the config path at the point of use for embedded callers. */
export declare function getConfigPath(env?: NodeJS.ProcessEnv): string;
/** Backward-compatible snapshot for callers that only need the startup path. */
export declare const CONFIG_PATH: string;
export declare function loadConfig(env?: NodeJS.ProcessEnv): WjxConfig | null;
export declare function saveConfig(config: WjxConfig): void;
/**
 * Apply the legacy config's credential fallback to process.env.
 *
 * Routing values stay in the resolved profile so an explicitly selected
 * profile cannot be overwritten by values copied from `.wjxrc`. The SDK and
 * CLI pass the selected base URL per request instead of mutating global state.
 */
export declare function applyConfigToEnv(): void;
