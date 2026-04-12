import { z } from "zod";
/** 校验字符串是否为合法 JSON，在 handler 中调用（避免 Zod .refine() 导致 MCP 挂起） */
export declare function assertJson(value: string, fieldName: string): void;
/** 校验字符串是否为合法 JSON 数组 */
export declare function assertJsonArray(value: string, fieldName: string): void;
export declare function toolResult(data: unknown, isError: boolean): {
    content: {
        type: "text";
        text: string;
    }[];
    isError: boolean;
};
export declare function toolError(error: unknown): {
    content: {
        type: "text";
        text: string;
    }[];
    isError: boolean;
};
/**
 * Wrap a standard tool handler with try/catch + toolResult/toolError.
 * Use for tools where the handler is: call SDK → return toolResult(result, result.result === false).
 */
export declare function wrapToolHandler<A>(fn: (args: A) => Promise<{
    result?: boolean;
}>): (args: A) => Promise<{
    content: {
        type: "text";
        text: string;
    }[];
    isError: boolean;
}>;
/** Zod refinement: value must be valid JSON string. */
export declare const zJsonString: (msg: string) => z.ZodString;
/** Zod refinement: value must be a JSON array string. */
export declare const zJsonArray: (msg: string) => z.ZodString;
