import { chmodSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface WjxConfig {
  apiKey: string;
  baseUrl?: string;
  corpId?: string;
}

/** Resolve the config path at the point of use for embedded callers. */
export function getConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.WJX_CONFIG_PATH?.trim();
  return configured || join(homedir(), ".wjxrc");
}

/** Backward-compatible snapshot for callers that only need the startup path. */
export const CONFIG_PATH = getConfigPath();

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WjxConfig | null {
  try {
    const raw = readFileSync(getConfigPath(env), "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const apiKey = typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : "";
    if (!apiKey) return null;
    const baseUrl = typeof parsed.baseUrl === "string" && parsed.baseUrl.trim() ? parsed.baseUrl.trim() : undefined;
    const corpId = typeof parsed.corpId === "string" && parsed.corpId.trim() ? parsed.corpId.trim() : undefined;
    return { apiKey, ...(baseUrl ? { baseUrl } : {}), ...(corpId ? { corpId } : {}) };
  } catch {
    return null;
  }
}

export function saveConfig(config: WjxConfig): void {
  const configPath = getConfigPath();
  const temporaryPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(temporaryPath, JSON.stringify(config, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
    renameSync(temporaryPath, configPath);
    chmodSync(configPath, 0o600);
  } catch (error) {
    try { unlinkSync(temporaryPath); } catch { /* preserve original error */ }
    throw error;
  }
}

/**
 * Apply the legacy config's credential fallback to process.env.
 *
 * Routing values stay in the resolved profile so an explicitly selected
 * profile cannot be overwritten by values copied from `.wjxrc`. The SDK and
 * CLI pass the selected base URL per request instead of mutating global state.
 */
export function applyConfigToEnv(): void {
  const config = loadConfig();
  if (!config) return;

  if ((!process.env.WJX_API_KEY || !process.env.WJX_API_KEY.trim()) && config.apiKey.trim()) {
    process.env.WJX_API_KEY = config.apiKey;
  }
}
