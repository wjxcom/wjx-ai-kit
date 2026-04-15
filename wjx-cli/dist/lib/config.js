import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
/**
 * Evaluated once at module load time. Setting process.env.WJX_CONFIG_PATH
 * after import will NOT change this value. Tests override it by passing the
 * env var to child processes (e.g. via execFileSync env option).
 */
export const CONFIG_PATH = process.env.WJX_CONFIG_PATH || join(homedir(), ".wjxrc");
export function loadConfig() {
    try {
        const raw = readFileSync(CONFIG_PATH, "utf8");
        const parsed = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null && typeof parsed.apiKey === "string") {
            return parsed;
        }
        return null;
    }
    catch {
        return null;
    }
}
export function saveConfig(config) {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", {
        encoding: "utf8",
        mode: 0o600,
    });
}
/**
 * Apply config values to process.env where env vars are not already set.
 * This makes SDK layer (which reads process.env) automatically use config values.
 */
export function applyConfigToEnv() {
    const config = loadConfig();
    if (!config)
        return;
    if (!process.env.WJX_API_KEY && config.apiKey) {
        process.env.WJX_API_KEY = config.apiKey;
    }
    if (!process.env.WJX_BASE_URL && config.baseUrl) {
        process.env.WJX_BASE_URL = config.baseUrl;
    }
    if (!process.env.WJX_CORP_ID && config.corpId) {
        process.env.WJX_CORP_ID = config.corpId;
    }
}
//# sourceMappingURL=config.js.map