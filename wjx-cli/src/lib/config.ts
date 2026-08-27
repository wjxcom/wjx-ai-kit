import { chmodSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

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
export const CONFIG_PATH = process.env.WJX_CONFIG_PATH || join(homedir(), ".wjxrc");

export function loadConfig(): WjxConfig | null {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && typeof parsed.apiKey === "string") {
      return parsed as WjxConfig;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveConfig(config: WjxConfig): void {
  const temporaryPath = `${CONFIG_PATH}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(temporaryPath, JSON.stringify(config, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
    renameSync(temporaryPath, CONFIG_PATH);
    chmodSync(CONFIG_PATH, 0o600);
  } catch (error) {
    try { unlinkSync(temporaryPath); } catch { /* preserve original error */ }
    throw error;
  }
}

/**
 * Apply config values to process.env where env vars are not already set.
 * This makes SDK layer (which reads process.env) automatically use config values.
 */
export function applyConfigToEnv(): void {
  const config = loadConfig();
  if (!config) return;

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
