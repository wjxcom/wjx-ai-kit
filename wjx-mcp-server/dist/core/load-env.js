import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
/**
 * Credential resolution order (highest wins):
 * 1. Real environment variables (already in process.env at startup)
 * 2. ~/.wjxrc config file (shared with wjx-cli, written by `wjx init`)
 * 3. .env file (cwd or package root)
 *
 * Both ~/.wjxrc and .env only set keys that are NOT already present,
 * so loading order determines priority: wjxrc first, then .env.
 */
// ── Step 1: Load ~/.wjxrc (JSON config shared with wjx-cli) ──
const wjxrcPath = process.env.WJX_CONFIG_PATH?.trim() || join(homedir(), ".wjxrc");
const WJX_CONFIG_KEYS = new Set(["WJX_API_KEY", "WJX_BASE_URL", "WJX_CORP_ID"]);
function setIfMissing(key, value) {
    if (typeof value !== "string" || !value.trim())
        return;
    // Match the CLI: an explicitly blank WJX variable is treated as unset so a
    // valid shared .wjxrc value is not accidentally shadowed.
    const existing = process.env[key];
    if (existing !== undefined && (!WJX_CONFIG_KEYS.has(key) || existing.trim()))
        return;
    process.env[key] = value.trim();
}
if (existsSync(wjxrcPath)) {
    try {
        const parsed = JSON.parse(readFileSync(wjxrcPath, "utf-8"));
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
            const config = parsed;
            setIfMissing("WJX_API_KEY", config.apiKey);
            setIfMissing("WJX_BASE_URL", config.baseUrl);
            setIfMissing("WJX_CORP_ID", config.corpId);
        }
    }
    catch {
        // ~/.wjxrc read/parse error — skip silently
    }
}
// ── Step 2: Load .env file ──
/**
 * Resolve .env file path. Priority:
 * 1. process.cwd()/.env  (npx / user working directory)
 * 2. Package root .env   (__dirname/../../.env, for local dev)
 */
function findEnvFile() {
    const cwdPath = resolve(process.cwd(), ".env");
    if (existsSync(cwdPath))
        return cwdPath;
    const pkgPath = resolve(__dirname, "..", "..", ".env");
    if (existsSync(pkgPath))
        return pkgPath;
    return undefined;
}
const envPath = findEnvFile();
if (envPath) {
    try {
        const content = readFileSync(envPath, "utf-8");
        for (const line of content.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#"))
                continue;
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx === -1)
                continue;
            const key = trimmed.slice(0, eqIdx).trim();
            let value = trimmed.slice(eqIdx + 1).trim();
            // Strip inline comments (unquoted values only)
            if (value[0] !== '"' && value[0] !== "'") {
                const commentIdx = value.indexOf(" #");
                if (commentIdx !== -1)
                    value = value.slice(0, commentIdx).trimEnd();
            }
            // Strip surrounding quotes (single or double)
            if (value.length >= 2 &&
                ((value[0] === '"' && value[value.length - 1] === '"') ||
                    (value[0] === "'" && value[value.length - 1] === "'"))) {
                value = value.slice(1, -1);
            }
            setIfMissing(key, value);
        }
    }
    catch {
        // .env file read error — skip silently
    }
}
//# sourceMappingURL=load-env.js.map