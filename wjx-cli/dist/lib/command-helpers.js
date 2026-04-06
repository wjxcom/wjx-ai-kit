import { getCredentials } from "./auth.js";
import { formatOutput } from "./output.js";
import { CliError, handleError } from "./errors.js";
import { mergeStdinWithOpts } from "./stdin.js";
import { maskAuthHeader } from "./mask.js";
/**
 * Strict integer parser. Rejects garbage like "123abc".
 */
export function strictInt(v) {
    if (v === "") {
        throw new CliError("INPUT_ERROR", `Invalid integer: ""`);
    }
    const n = Number(v);
    if (!Number.isInteger(n)) {
        throw new CliError("INPUT_ERROR", `Invalid integer: "${v}"`);
    }
    return n;
}
/**
 * Require a field in the merged input. Throws INPUT_ERROR if missing.
 */
export function requireField(merged, field, label) {
    if (merged[field] === undefined || merged[field] === null) {
        throw new CliError("INPUT_ERROR", `Missing required option: --${label || field}`);
    }
}
export function createCapturingFetch() {
    let captured = null;
    const fetchImpl = async (url, init) => {
        const headers = {};
        if (init?.headers) {
            for (const [k, v] of Object.entries(init.headers)) {
                headers[k] = k.toLowerCase() === "authorization" ? maskAuthHeader(String(v)) : String(v);
            }
        }
        captured = {
            method: init?.method ?? "GET",
            url: String(url),
            headers,
            body: init?.body ? String(init.body) : "",
        };
        return new Response(JSON.stringify({ result: true, data: {} }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    };
    return { fetchImpl, getCapturedRequest: () => captured };
}
export function printDryRunPreview(request) {
    process.stderr.write(JSON.stringify({ dry_run: true, request }, null, 2) + "\n");
}
/**
 * Merge stdin data with CLI opts (source-aware).
 * Extracts the common pattern used in both executeCommand and manual handlers.
 */
export function getMerged(cmd) {
    const stdinData = cmd.__stdinData;
    if (stdinData && Object.keys(stdinData).length > 0) {
        return mergeStdinWithOpts(stdinData, cmd);
    }
    return { ...cmd.opts() };
}
/**
 * Central command executor.
 * - Merges stdin data with CLI opts (source-aware)
 * - Gets credentials (unless noAuth)
 * - Calls SDK function
 * - Checks result===false (P0 fix)
 * - Formats output to stdout
 * - Routes errors to stderr JSON with correct exit codes
 */
export async function executeCommand(program, actionCommand, sdkFn, buildInput, opts = {}) {
    try {
        const merged = getMerged(actionCommand);
        const input = buildInput(merged);
        const globalOpts = program.opts();
        if (opts.noAuth) {
            if (globalOpts.dryRun) {
                process.stderr.write(JSON.stringify({
                    dry_run: true,
                    note: "本地命令，不会发送 API 请求",
                    input,
                }, null, 2) + "\n");
                return;
            }
            // Local commands (e.g. buildSurveyUrl) — call with input only
            const localFn = sdkFn;
            const result = localFn(input);
            formatOutput(result, globalOpts);
            return;
        }
        const creds = getCredentials(globalOpts);
        if (globalOpts.dryRun) {
            const { fetchImpl, getCapturedRequest } = createCapturingFetch();
            await sdkFn(input, creds, fetchImpl);
            printDryRunPreview(getCapturedRequest());
            return;
        }
        const result = await sdkFn(input, creds);
        // P0 fix: detect SDK API failure response
        if (result.result === false) {
            throw new CliError("API_ERROR", result.errormsg || "API request failed");
        }
        const output = opts.transformResult ? opts.transformResult(result) : result;
        formatOutput(output, globalOpts);
    }
    catch (e) {
        handleError(e);
    }
}
//# sourceMappingURL=command-helpers.js.map