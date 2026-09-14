import { getWjxCredentials } from "../../core/api-client.js";
import type { FetchLike, WjxCredentials } from "../../core/types.js";
import { queryWjxDsl } from "./client.js";
import type { VerifyWjxDslWriteInput, VerifyWjxDslWriteResult } from "./types.js";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function dslShape(value: string): { title?: string; topics: string[] } {
  const titleMatch = /questionnaire\s*\{[\s\S]*?attr\s+"Title"\s*=\s*"((?:\\.|[^"\\])*)"/i.exec(value);
  const topics: string[] = [];
  const pattern = /attr\s+"Topic"\s*=\s*"([^"\\]*(?:\\.[^"\\]*)*)"/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) topics.push(match[1]);
  return { ...(titleMatch ? { title: titleMatch[1] } : {}), topics };
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
  const structure = identity
    && actualDsl.length > 0
    && (expected.title === undefined || actual.title === expected.title)
    && expected.topics.every((topic) => actual.topics.includes(topic));
  if (!actualDsl) warnings.push("DSL read-back did not include canonical DSL text");
  if (expected.title !== undefined && actual.title !== expected.title) warnings.push("DSL read-back title differs from the requested DSL");
  if (!expected.topics.every((topic) => actual.topics.includes(topic))) warnings.push("DSL read-back is missing one or more requested Topic values");

  const status = statusLabel(data.status ?? data.state);
  if (!status) warnings.push("DSL read-back status is missing or unrecognized");
  const sid = typeof data.sid === "string" ? data.sid : undefined;
  const hasLink = Boolean(input.linkHint || sid || data.pc_path || data.mobile_path || data.fill_url || data.fillUrl);
  if (!hasLink) warnings.push("DSL read-back did not include a respondent link or sid");
  return {
    vid: input.vid,
    verification: { structure, status: Boolean(status), link: hasLink },
    outcome: structure && Boolean(status) && (hasLink || input.requireLink === false) ? "verified" : "unknown",
    actualQuestionCount: actual.topics.length,
    warnings,
    ...(status ? { status } : {}),
    ...(sid ? { sid } : {}),
  };
}
