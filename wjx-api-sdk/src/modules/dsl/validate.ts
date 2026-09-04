import type {
  WjxDslDiagnostic,
  WjxDslGenerationResult,
  WjxDslValidationOptions,
} from "./types.js";

export const MAX_WJX_DSL_BYTES = 4 * 1024 * 1024;

function diagnostic(code: string, message: string, line?: number): WjxDslDiagnostic {
  return { severity: "Error", code, message, ...(line === undefined ? {} : { line }) };
}

/** Lightweight protocol checks. Semantic validation remains authoritative on the server. */
export function validateWjxDsl(
  value: unknown,
  options: WjxDslValidationOptions = {},
): WjxDslDiagnostic[] {
  if (typeof value !== "string") return [diagnostic("DSL_TYPE", "dsl 必须是字符串")];
  const maxBytes = options.maxBytes ?? MAX_WJX_DSL_BYTES;
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes === 0 || value.trim().length === 0) return [diagnostic("DSL_EMPTY", "dsl 不能为空")];
  if (bytes > maxBytes) return [diagnostic("DSL_TOO_LARGE", `dsl 超过 ${maxBytes} 字节限制`)];

  const diagnostics: WjxDslDiagnostic[] = [];
  const first = value.replace(/^\uFEFF/, "").trimStart();
  if (!/^wjx-dsl\s+1\s*;/i.test(first)) diagnostics.push(diagnostic("DSL_HEADER", "DSL 必须以 wjx-dsl 1; 开头"));
  if (!/\bquestionnaire\s*\{/i.test(first)) diagnostics.push(diagnostic("DSL_ROOT", "DSL 缺少 questionnaire 根节点"));

  let depth = 0;
  let quote = false;
  let escaped = false;
  const lines = value.split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    for (const char of lines[lineIndex]) {
      if (escaped) { escaped = false; continue; }
      if (char === "\\" && quote) { escaped = true; continue; }
      if (char === '"') { quote = !quote; continue; }
      if (quote) continue;
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      if (depth < 0) {
        diagnostics.push(diagnostic("DSL_BRACES", "DSL 包含多余的右花括号", lineIndex + 1));
        depth = 0;
      }
    }
  }
  if (quote) diagnostics.push(diagnostic("DSL_STRING", "DSL 包含未闭合字符串"));
  if (depth !== 0) diagnostics.push(diagnostic("DSL_BRACES", "DSL 花括号未配对"));
  return diagnostics.slice(0, options.maxDiagnostics ?? 100);
}

export function normalizeWjxDsl(value: string): string {
  return value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

export function generateWjxDsl(value: string, options?: WjxDslValidationOptions): WjxDslGenerationResult {
  const dsl = normalizeWjxDsl(value);
  const diagnostics = validateWjxDsl(dsl, options);
  return { dsl, diagnostics, valid: diagnostics.every((item) => item.severity !== "Error"), byteLength: Buffer.byteLength(dsl, "utf8") };
}
