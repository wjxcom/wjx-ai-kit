import type {
  WjxDslDiagnostic,
  WjxDslGenerationResult,
  WjxDslValidationOptions,
} from "./types.js";

export const MAX_WJX_DSL_BYTES = 4 * 1024 * 1024;
const MAX_FILE_UPLOAD_SIZE = 2048000;

function diagnostic(code: string, message: string, line?: number): WjxDslDiagnostic {
  return { severity: "Error", code, message, ...(line === undefined ? {} : { line }) };
}

function maskDslComments(value: string): string {
  const chars = value.split("");
  let quote = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = 0; i < chars.length; i += 1) {
    const current = chars[i];
    const next = chars[i + 1];
    if (lineComment) {
      if (current === "\n" || current === "\r") lineComment = false;
      else chars[i] = " ";
      continue;
    }
    if (blockComment) {
      if (current === "*" && next === "/") {
        chars[i] = " "; chars[i + 1] = " "; i += 1; blockComment = false;
      } else if (current !== "\n" && current !== "\r") chars[i] = " ";
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === '"') quote = false;
      continue;
    }
    if (current === '"') quote = true;
    else if (current === "/" && next === "/") {
      chars[i] = " "; chars[i + 1] = " "; i += 1; lineComment = true;
    } else if (current === "/" && next === "*") {
      chars[i] = " "; chars[i + 1] = " "; i += 1; blockComment = true;
    } else if (current === "#") {
      chars[i] = " "; lineComment = true;
    }
  }
  return chars.join("");
}

function matchingBrace(value: string, openIndex: number): number {
  let depth = 0;
  let quote = false;
  let escaped = false;
  for (let i = openIndex; i < value.length; i += 1) {
    const current = value[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === '"') quote = false;
      continue;
    }
    if (current === '"') quote = true;
    else if (current === "{") depth += 1;
    else if (current === "}" && --depth === 0) return i;
  }
  return -1;
}

function topLevelAttribute(body: string, name: string): string | undefined {
  const pattern = new RegExp(`\\battr\\s+(?:"${name}"|${name})\\s*=\\s*(?:"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"|([^;\\s]+))`, "i");
  let depth = 0;
  let quote = false;
  let escaped = false;
  for (let i = 0; i < body.length; i += 1) {
    const current = body[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === '"') quote = false;
      continue;
    }
    if (current === '"') quote = true;
    else if (current === "{") depth += 1;
    else if (current === "}") depth -= 1;
    if (depth !== 0 || !body.startsWith("attr", i)) continue;
    const match = pattern.exec(body.slice(i));
    if (match && match.index === 0) return match[1] ?? match[2] ?? "";
  }
  return undefined;
}

function lineNumber(value: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (value[i] === "\n") line += 1;
  return line;
}

function isInsideQuotedString(value: string, index: number): boolean {
  let quote = false;
  let escaped = false;
  for (let i = 0; i < index; i += 1) {
    const current = value[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === '"') quote = false;
    } else if (current === '"') {
      quote = true;
    }
  }
  return quote;
}

function validateFileUploadMaxSizes(value: string, diagnostics: WjxDslDiagnostic[]): void {
  const masked = maskDslComments(value);
  const candidatePattern = /\bquestion(?:\s+(fileupload|signature|drawing))?\s*\{|\bnode\s+"Question"\s*\{/gi;
  let match: RegExpExecArray | null;
  while ((match = candidatePattern.exec(masked)) !== null) {
    if (isInsideQuotedString(masked, match.index)) continue;
    const openIndex = masked.indexOf("{", match.index);
    const closeIndex = matchingBrace(masked, openIndex);
    if (openIndex < 0 || closeIndex < 0) continue;
    const body = value.slice(openIndex + 1, closeIndex);
    const alias = (match[1] ?? "").toLowerCase();
    const type = alias || (topLevelAttribute(body, "Type") ?? "").toLowerCase();
    if (type !== "fileupload") continue;
    const maxSize = topLevelAttribute(body, "MaxSize");
    if (maxSize === undefined && (alias === "signature" || alias === "drawing")) continue;
    const parsed = maxSize === undefined ? NaN : Number(maxSize);
    if (maxSize === undefined || !/^\d+$/.test(maxSize) || !Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_FILE_UPLOAD_SIZE) {
      diagnostics.push(diagnostic("DSL_FILE_LIMIT", "fileupload MaxSize must be explicitly set to an integer from 1 to 2048000.", lineNumber(value, openIndex)));
    }
  }
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
  validateFileUploadMaxSizes(value, diagnostics);
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
