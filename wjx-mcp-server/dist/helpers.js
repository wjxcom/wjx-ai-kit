import { z } from "zod";
/** 校验字符串是否为合法 JSON，在 handler 中调用（避免 Zod .refine() 导致 MCP 挂起） */
export function assertJson(value, fieldName) {
    try {
        JSON.parse(value);
    }
    catch {
        throw new Error(`${fieldName} 必须是合法的 JSON 字符串`);
    }
}
/** 校验字符串是否为合法 JSON 数组 */
export function assertJsonArray(value, fieldName) {
    let parsed;
    try {
        parsed = JSON.parse(value);
    }
    catch {
        throw new Error(`${fieldName} 必须是合法的 JSON 字符串`);
    }
    if (!Array.isArray(parsed))
        throw new Error(`${fieldName} 必须是 JSON 数组`);
}
export function toolResult(data, isError) {
    let text;
    if (data === undefined) {
        text = isError ? '{"result":false,"errormsg":"no data"}' : "null";
    }
    else {
        try {
            text = JSON.stringify(data);
        }
        catch {
            text = String(data);
        }
    }
    return {
        content: [{ type: "text", text }],
        isError,
    };
}
export function toolError(error) {
    const msg = error instanceof Error ? error.message : String(error);
    return toolResult({ result: false, errormsg: msg }, true);
}
/**
 * Wrap a standard tool handler with try/catch + toolResult/toolError.
 * Use for tools where the handler is: call SDK → return toolResult(result, result.result === false).
 */
export function wrapToolHandler(fn) {
    return async (args) => {
        try {
            const result = await fn(args);
            return toolResult(result, result.result === false);
        }
        catch (error) {
            return toolError(error);
        }
    };
}
// ─── Zod JSON validation helpers ──────────────────────────────────────
/** Zod refinement: value must be valid JSON string. */
export const zJsonString = (msg) => z.string().refine((s) => { try {
    JSON.parse(s);
    return true;
}
catch {
    return false;
} }, msg);
/** Zod refinement: value must be a JSON array string. */
export const zJsonArray = (msg) => z.string().refine((s) => { try {
    return Array.isArray(JSON.parse(s));
}
catch {
    return false;
} }, msg);
//# sourceMappingURL=helpers.js.map