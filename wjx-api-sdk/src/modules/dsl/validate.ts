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

function countTopLevelBlocks(body: string, names: string[]): number {
  const masked = maskDslComments(body);
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  let depth = 0;
  let count = 0;
  const token = /(?:node\s+"([A-Za-z_][A-Za-z0-9_]*)"|([A-Za-z_][A-Za-z0-9_]*))\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = token.exec(masked)) !== null) {
    const name = (match[1] ?? match[2]).toLowerCase();
    if (depth === 0 && wanted.has(name)) count += 1;
    const open = masked.indexOf("{", match.index);
    const close = matchingBrace(masked, open);
    if (close >= 0) token.lastIndex = Math.max(token.lastIndex, close + 1);
  }
  return count;
}

function validateQuestionSemantics(value: string, diagnostics: WjxDslDiagnostic[]): void {
  const masked = maskDslComments(value);
  const pattern = /\bquestion\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{|\bnode\s+"Question"\s*\{/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(masked)) !== null) {
    const open = masked.indexOf("{", match.index);
    const close = matchingBrace(masked, open);
    if (open < 0 || close < 0) continue;
    const body = value.slice(open + 1, close);
    const type = (match[1] ?? topLevelAttribute(body, "Type") ?? "").trim().toLowerCase();
    const items = countTopLevelBlocks(body, ["item"]);
    const rows = countTopLevelBlocks(body, ["row"]);
    const columns = countTopLevelBlocks(body, ["column"]);
    const referTopic = Number(topLevelAttribute(body, "ReferTopic"));
    const reference = Number.isInteger(referTopic) && referTopic > 0;
    if (["radio", "radio_down", "check"].includes(type) && items === 0 && !reference) diagnostics.push(diagnostic("DSL_QUESTION_SHAPE", `题型 ${type} 至少需要一个 Item。`));
    if (type === "gapfill") {
      const count = Number(topLevelAttribute(body, "GapCount"));
      const titleCount = (topLevelAttribute(body, "Title")?.match(/___/g) ?? []).length;
      if (!Number.isSafeInteger(count) || count <= 0) diagnostics.push(diagnostic("DSL_GAP_COUNT", "gapfill 的 GapCount 必须存在且为正整数。"));
      else if (rows > 0 && rows !== count) diagnostics.push(diagnostic("DSL_QUESTION_SHAPE", "gapfill 的 ItemRow 数量必须与 GapCount 一致。"));
      else if (rows > 0 && titleCount === 0) diagnostics.push(diagnostic("DSL_QUESTION_SHAPE", "gapfill 标题必须使用 ___ 空位标记。"));
      else if (rows === 0 && titleCount !== count) diagnostics.push(diagnostic("DSL_QUESTION_SHAPE", "gapfill 标题中的 ___ 数量必须与 GapCount 一致。"));
    }
    if (type === "matrix") {
      const mode = Number(topLevelAttribute(body, "Mode"));
      if ([301, 302, 303].includes(mode) && columns === 0) diagnostics.push(diagnostic("DSL_MATRIX_SHAPE", `matrix Mode=${mode} 至少需要一个 ItemColumn。`));
      if ([201, 202, 203, 204, 301, 302, 303].includes(mode) && rows === 0 && !reference) diagnostics.push(diagnostic("DSL_MATRIX_SHAPE", `matrix Mode=${mode} 至少需要一个 ItemRow。`));
      if ([101, 102, 103, 2, 3, 6, 7, 303].includes(mode) && items === 0) diagnostics.push(diagnostic("DSL_MATRIX_SHAPE", `matrix Mode=${mode} 至少需要一个 Item。`));
      if (mode === 301) {
        const min = Number(topLevelAttribute(body, "MinValue"));
        const max = Number(topLevelAttribute(body, "MaxValue"));
        if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 0 || min >= max) diagnostics.push(diagnostic("DSL_MATRIX_RANGE", "表格数值必须显式满足 0 <= MinValue < MaxValue。"));
      }
      const verify = (topLevelAttribute(body, "Verify") ?? "").trim().toLowerCase();
      if (mode === 302 && verify === "conjoint") {
        const taskCount = Number(topLevelAttribute(body, "ConjointTaskCount"));
        const taskLength = Number(topLevelAttribute(body, "ConjointTaskLength"));
        if (!Number.isSafeInteger(taskCount) || taskCount <= 0) diagnostics.push(diagnostic("DSL_CONJOINT_TASK", "联合分析必须设置正整数 ConjointTaskCount。"));
        if (!Number.isSafeInteger(taskLength) || taskLength <= 0) diagnostics.push(diagnostic("DSL_CONJOINT_TASK", "联合分析必须设置正整数 ConjointTaskLength。"));
        if (columns < 3) diagnostics.push(diagnostic("DSL_CONJOINT_SHAPE", "联合分析至少需要两个属性列和一个是否选中列。"));
      }
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
  validateQuestionSemantics(value, diagnostics);
  return diagnostics.slice(0, options.maxDiagnostics ?? 100);
}

export function normalizeWjxDsl(value: string): string {
  // The legacy editor's gap-fill parser recognizes three underscores. Accept
  // the author-friendly `{_}` spelling and normalize it before transport.
  return value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/\{_\}/g, "___");
}

export function generateWjxDsl(value: string, options?: WjxDslValidationOptions): WjxDslGenerationResult {
  const dsl = normalizeWjxDsl(value);
  const diagnostics = validateWjxDsl(dsl, options);
  return { dsl, diagnostics, valid: diagnostics.every((item) => item.severity !== "Error"), byteLength: Buffer.byteLength(dsl, "utf8") };
}
