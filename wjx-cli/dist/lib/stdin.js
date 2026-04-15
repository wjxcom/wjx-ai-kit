import { CliError } from "./errors.js";
/**
 * Read JSON from stdin. Returns parsed object or empty object if no data.
 */
export async function readStdin() {
    // If stdin is a TTY (no pipe), return empty
    if (process.stdin.isTTY) {
        return {};
    }
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    if (!raw) {
        return {};
    }
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            throw new CliError("INPUT_ERROR", `stdin JSON must be an object, got ${Array.isArray(parsed) ? "array" : typeof parsed}`);
        }
        return parsed;
    }
    catch (e) {
        if (e instanceof CliError)
            throw e;
        throw new CliError("INPUT_ERROR", `stdin JSON parse error: ${e instanceof Error ? e.message : String(e)}`);
    }
}
/**
 * Source-aware merge: stdin as base, only CLI-explicit args override.
 * Uses Commander's getOptionValueSource() to distinguish user input from defaults.
 */
export function mergeStdinWithOpts(stdinData, command) {
    const opts = command.opts();
    const merged = { ...stdinData };
    for (const key of Object.keys(opts)) {
        // Skip internal flags
        if (key === "stdin" || key === "apiKey" || key === "json" || key === "table" || key === "dryRun") {
            continue;
        }
        const source = command.getOptionValueSource(key);
        // Only override stdin with explicitly provided CLI values, not defaults
        if (source === "cli") {
            merged[key] = opts[key];
        }
    }
    return merged;
}
//# sourceMappingURL=stdin.js.map