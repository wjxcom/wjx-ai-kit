/** Lightweight client-side checks for the WJX XML DSL contract.
 *
 * The server remains the source of truth. These checks only cover deterministic
 * failures that can otherwise be reported as a generic 46007 response.
 */

interface QuestionBlock {
  type: string;
  body: string;
  start: number;
}

function lineAt(text: string, offset: number): number {
  return text.slice(0, offset).split("\n").length;
}

function findMatchingBrace(text: string, openIndex: number): number {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        quoted = false;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
      if (depth < 0) return -1;
    }
  }
  return -1;
}

function validateBalancedDelimiters(text: string): void {
  let braces = 0;
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        quoted = false;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === "{") {
      braces += 1;
    } else if (ch === "}") {
      braces -= 1;
      if (braces < 0) throw new Error(`DSL validation failed at line ${lineAt(text, i)}: unexpected '}'`);
    }
  }
  if (quoted) throw new Error("DSL validation failed: unterminated quoted attribute value");
  if (braces !== 0) throw new Error("DSL validation failed: unbalanced braces");
}

function readAttr(body: string, name: string): string | undefined {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`attr\\s+"${escapedName}"\\s*=\\s*"([^"]*)"`).exec(body);
  return match?.[1];
}

function findQuestionBlocks(text: string): QuestionBlock[] {
  const blocks: QuestionBlock[] = [];
  const pattern = /\bquestion\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const openIndex = text.indexOf("{", match.index);
    const closeIndex = findMatchingBrace(text, openIndex);
    if (closeIndex < 0) {
      throw new Error(`DSL validation failed at line ${lineAt(text, match.index)}: question block is not closed`);
    }
    blocks.push({ type: match[1], body: text.slice(openIndex + 1, closeIndex), start: match.index });
    pattern.lastIndex = closeIndex + 1;
  }
  return blocks;
}

function findCanonicalQuestionBlocks(text: string): QuestionBlock[] {
  const blocks: QuestionBlock[] = [];
  const pattern = /\bnode\s+"Question"\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const openIndex = text.indexOf("{", match.index);
    const closeIndex = findMatchingBrace(text, openIndex);
    if (closeIndex < 0) {
      throw new Error(`DSL validation failed at line ${lineAt(text, match.index)}: Question node is not closed`);
    }
    const body = text.slice(openIndex + 1, closeIndex);
    blocks.push({ type: readAttr(body, "Type") ?? "unknown", body, start: match.index });
    pattern.lastIndex = closeIndex + 1;
  }
  return blocks;
}

function validateMatrixRange(text: string, block: QuestionBlock): void {
  if (block.type !== "matrix" || readAttr(block.body, "Mode") !== "302") return;
  const minRaw = readAttr(block.body, "MinValue");
  const maxRaw = readAttr(block.body, "MaxValue");
  if (minRaw === undefined && maxRaw === undefined) return;
  if (minRaw === undefined || maxRaw === undefined) {
    throw new Error(`DSL validation failed at line ${lineAt(text, block.start)}: Mode=302 MinValue and MaxValue must be provided together`);
  }
  const min = Number(minRaw);
  const max = Number(maxRaw);
  if (!Number.isFinite(min) || !Number.isFinite(max) || !((min === 0 && max === 0) || (min > 0 && min <= max))) {
    throw new Error("DSL validation failed: Mode=302 requires both MinValue/MaxValue to be absent, both 0, or 0 < MinValue <= MaxValue");
  }
}

/** Validate deterministic WJX XML DSL v1 rules before a write request. */
export function validateWjxDsl(dsl: string): void {
  const text = dsl.charCodeAt(0) === 0xfeff ? dsl.slice(1) : dsl;
  if (!/^\s*wjx-dsl\s+1\s*;/i.test(text)) {
    throw new Error("DSL validation failed: first statement must be 'wjx-dsl 1;'");
  }
  if (!/\bquestionnaire\s*\{/i.test(text)) {
    throw new Error("DSL validation failed: questionnaire block is required");
  }
  validateBalancedDelimiters(text);
  const blocks = findQuestionBlocks(text);
  if (blocks.length === 0) blocks.push(...findCanonicalQuestionBlocks(text));
  const topics: number[] = [];
  for (const block of blocks) {
    const rawTopic = readAttr(block.body, "Topic");
    if (rawTopic === undefined || !/^\d+$/.test(rawTopic)) {
      throw new Error(`DSL validation failed at line ${lineAt(text, block.start)}: every question requires a positive integer Topic`);
    }
    const topic = Number(rawTopic);
    if (!Number.isSafeInteger(topic) || topic < 1) {
      throw new Error(`DSL validation failed at line ${lineAt(text, block.start)}: Topic must be a positive integer`);
    }
    topics.push(topic);
    validateMatrixRange(text, block);
  }
  const sorted = [...topics].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i] !== i + 1) {
      throw new Error(`DSL validation failed: answerable question Topic values must be continuous 1..${sorted.length}`);
    }
  }
}
