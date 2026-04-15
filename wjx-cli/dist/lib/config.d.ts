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
 * Apply config values to process.env where env vars are not already set.
 * This makes SDK layer (which reads process.env) automatically use config values.
 */
export declare function applyConfigToEnv(): void;
