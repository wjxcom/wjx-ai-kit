/** 校验字符串是否为合法 JSON，在 handler 中调用（避免 Zod .refine() 导致 MCP 挂起） */
export function assertJson(value: string, fieldName: string): void {
  try { JSON.parse(value); } catch { throw new Error(`${fieldName} 必须是合法的 JSON 字符串`); }
}

/** 校验字符串是否为合法 JSON 数组 */
export function assertJsonArray(value: string, fieldName: string): void {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error(`${fieldName} 必须是合法的 JSON 字符串`); }
  if (!Array.isArray(parsed)) throw new Error(`${fieldName} 必须是 JSON 数组`);
}

export function toolResult(data: unknown, isError: boolean) {
  let text: string;
  if (data === undefined) {
    text = isError ? '{"result":false,"errormsg":"no data"}' : "null";
  } else {
    try {
      text = JSON.stringify(data);
    } catch {
      text = String(data);
    }
  }
  return {
    content: [{ type: "text" as const, text }],
    isError,
  };
}

export function toolError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return toolResult({ result: false, errormsg: msg }, true);
}
