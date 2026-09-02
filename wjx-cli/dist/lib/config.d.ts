export interface WjxConfig {
    apiKey: string;
    baseUrl?: string;
    corpId?: string;
}
/**
 * Evaluated once at module load time. Setting process.env.WJX_CONFIG_PATH
 * after import will NOT change this value. Tests override it by passing the
 * env var to child processes (e.g. via execFileSync env option).
 */
export declare const CONFIG_PATH: string;
export declare function loadConfig(): WjxConfig | null;
export declare function saveConfig(config: WjxConfig): void;
/**
 * Apply the legacy config's credential fallback to process.env.
 *
 * Routing values stay in the resolved profile so an explicitly selected
 * profile cannot be overwritten by values copied from `.wjxrc`. The SDK and
 * CLI pass the selected base URL per request instead of mutating global state.
 */
export declare function applyConfigToEnv(): void;
