import { getWjxCredentials } from "../../core/api-client.js";
import type { FetchLike, WjxCredentials } from "../../core/types.js";
import { queryWjxDsl } from "./client.js";
import type { VerifyWjxDslWriteInput, VerifyWjxDslWriteResult } from "./types.js";
import { isInsideQuotedString, maskDslComments, matchingBrace } from "./validate.js";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

interface DslBlock {
  type?: string;
  attributes: Record<string, string>;
  children: Array<{ name: string; attributes: Record<string, string> }>;
}

function topLevelAttributes(body: string): Record<string, string> {
  const masked = maskDslComments(body);
  const attributes: Record<string, string> = Object.create(null) as Record<string, string>;
  const pattern = /^attr\s+(?:"([A-Za-z_][A-Za-z0-9_.:-]*)"|([A-Za-z_][A-Za-z0-9_.:-]*))\s*=\s*(?:"((?:\\.|[^"\\])*)"|([^;\s]+))\s*;/i;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < masked.length; index++) {
    const char = masked[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === "{") { depth++; continue; }
    if (char === "}") { depth--; continue; }
    if (depth !== 0 || !masked.startsWith("attr", index)) continue;
    const match = pattern.exec(masked.slice(index));
    if (!match) continue;
    const raw = match[3] ?? match[4] ?? "";
    let decoded = raw;
    if (match[3] !== undefined) {
      try { decoded = JSON.parse(`"${raw}"`) as string; } catch { /* keep wire spelling */ }
    }
    attributes[match[1] ?? match[2]] = decoded;
    index += match[0].length - 1;
  }
  return attributes;
}

function questionBlocks(value: string): DslBlock[] {
  const masked = maskDslComments(value);
  const questions: DslBlock[] = [];
  const pattern = /\bquestion\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{|\bnode\s+"Question"\s*\{/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(masked)) !== null) {
    if (isInsideQuotedString(masked, match.index)) continue;
    const open = masked.indexOf("{", match.index);
    const close = matchingBrace(masked, open);
    if (close < 0) break;
    const body = value.slice(open + 1, close);
    const maskedBody = masked.slice(open + 1, close);
    const children: DslBlock["children"] = [];
    const childPattern = /\b(item|row|column|rightrow)\s*\{|\bnode\s+"(Item|ItemRow|ItemColumn|ItemRightRow)"\s*\{/gi;
    let child: RegExpExecArray | null;
    while ((child = childPattern.exec(maskedBody)) !== null) {
      if (isInsideQuotedString(maskedBody, child.index)) continue;
      const childOpen = maskedBody.indexOf("{", child.index);
      const childClose = matchingBrace(maskedBody, childOpen);
      if (childClose < 0) break;
      const name = (child[1] ?? ({ item: "item", itemrow: "row", itemcolumn: "column", itemrightrow: "rightrow" } as Record<string, string>)[child[2].toLowerCase()]).toLowerCase();
      children.push({ name, attributes: topLevelAttributes(body.slice(childOpen + 1, childClose)) });
      childPattern.lastIndex = childClose + 1;
    }
    const attributes = topLevelAttributes(body);
    const type = (match[1] ?? attributes.Type)?.toLowerCase();
    questions.push({ ...(type ? { type } : {}), attributes, children });
    pattern.lastIndex = close + 1;
  }
  return questions;
}

function containsAttributes(actual: Record<string, string>, expected: Record<string, string>): boolean {
  return Object.entries(expected).every(([name, value]) => actual[name] === value);
}

function containsChildren(actual: DslBlock["children"], expected: DslBlock["children"]): boolean {
  let offset = 0;
  return expected.every((child) => {
    const index = actual.findIndex((candidate, position) => position >= offset
      && candidate.name === child.name && containsAttributes(candidate.attributes, child.attributes));
    if (index < 0) return false;
    offset = index + 1;
    return true;
  });
}

const BASIC_QUESTION_TYPES = new Set(["radio", "radio_down", "check", "question", "gapfill", "fileupload", "slider", "matrix", "sum"]);

function questionTypeMatches(actual: DslBlock, expected: DslBlock): boolean {
  // Semantic aliases can be normalized by the server. A basic XML Type is
  // stable and must never be silently downgraded to another question family.
  return !expected.type || !BASIC_QUESTION_TYPES.has(expected.type) || actual.type === expected.type;
}

function dslShape(value: string): { title?: string; topics: string[]; questions: DslBlock[] } {
  const masked = maskDslComments(value);
  const root = /\bquestionnaire\s*\{/i.exec(masked);
  const open = root ? masked.indexOf("{", root.index) : -1;
  const close = open < 0 ? -1 : matchingBrace(masked, open);
  const title = close < 0 ? undefined : topLevelAttributes(value.slice(open + 1, close)).Title;
  const questions = questionBlocks(value);
  const topics = questions.map((question) => question.attributes.Topic).filter((topic): topic is string => topic !== undefined);
  return { ...(title === undefined ? {} : { title }), topics, questions };
}

function statusLabel(value: unknown): string | undefined {
  const numeric = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : undefined;
  if (numeric === undefined) return typeof value === "string" && value.trim() ? value : undefined;
  return ({ 0: "draft", 1: "published", 2: "paused", 3: "deleted", 4: "hard-deleted", 5: "reviewed" } as Record<number, string>)[numeric];
}

/** Read back the canonical DSL after a write and verify identity, structure, status and link fields. */
export async function verifyWjxDslWrite(
  input: VerifyWjxDslWriteInput,
): Promise<VerifyWjxDslWriteResult> {
  const credentials: WjxCredentials = input.credentials ?? getWjxCredentials();
  const fetchImpl: FetchLike | undefined = input.fetchImpl;
  const expected = dslShape(input.expectedDsl);
  const warnings: string[] = [];
  const response = await queryWjxDsl({ vid: input.vid, get_questions: true, get_items: true, get_exts: true, get_setting: true, get_page_cut: true }, credentials, fetchImpl);
  const data = response.result === true ? asRecord(response.data) : undefined;
  if (!data) {
    return { vid: input.vid, verification: { structure: false, status: false, link: false }, outcome: "unknown", warnings: [response.result === false ? response.errormsg : "DSL read-back response was invalid"] };
  }

  const actualVid = data.vid ?? data.activity_id ?? data.activityId;
  const identity = String(actualVid ?? "") === String(input.vid);
  if (!identity) warnings.push("DSL read-back identity differs from the requested vid");
  const actualDsl = typeof data.dsl === "string" ? data.dsl : "";
  const actual = dslShape(actualDsl);
  const questionContentMatches = expected.questions.every((question) => {
    const topic = question.attributes.Topic;
    const matching = topic === undefined ? undefined : actual.questions.find((candidate) => candidate.attributes.Topic === topic);
    return Boolean(matching
      && questionTypeMatches(matching, question)
      && containsAttributes(matching.attributes, question.attributes)
      && containsChildren(matching.children, question.children));
  });
  const structure = identity
    && actualDsl.length > 0
    && (expected.title === undefined || actual.title === expected.title)
    && expected.topics.every((topic) => actual.topics.includes(topic))
    && questionContentMatches;
  if (!actualDsl) warnings.push("DSL read-back did not include canonical DSL text");
  if (expected.title !== undefined && actual.title !== expected.title) warnings.push("DSL read-back title differs from the requested DSL");
  if (!expected.topics.every((topic) => actual.topics.includes(topic))) warnings.push("DSL read-back is missing one or more requested Topic values");
  if (!questionContentMatches) warnings.push("DSL read-back lost or changed an explicitly requested question type, attribute, row, column or option");

  const status = statusLabel(data.status ?? data.state);
  if (!status) warnings.push("DSL read-back status is missing or unrecognized");
  const sid = typeof data.sid === "string" ? data.sid : undefined;
  const hasLink = Boolean(input.linkHint || sid || data.pc_path || data.mobile_path || data.fill_url || data.fillUrl);
  const linkRelevant = status !== "draft";
  if (!hasLink && linkRelevant) warnings.push("DSL read-back did not include a respondent link or sid");
  return {
    vid: input.vid,
    verification: { structure, status: Boolean(status), link: hasLink || !linkRelevant },
    outcome: structure && Boolean(status) && (!linkRelevant || hasLink || input.requireLink === false) ? "verified" : "unknown",
    actualQuestionCount: actual.topics.length,
    warnings,
    ...(status ? { status } : {}),
    ...(sid ? { sid } : {}),
  };
}
