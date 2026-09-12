import { buildPreviewUrl, getSurvey, listSurveys, getWjxBaseUrl } from "wjx-api-sdk";
import type { WjxApiResponse, WjxCredentials, FetchLike } from "wjx-api-sdk";
import { compareJsonlQuestionTypes, filterJsonlVerificationQuestions } from "wjx-api-sdk";
import type { JsonlQuestionTypeExpectation } from "wjx-api-sdk";
import { surveyIdentityMatches } from "./identity.js";

export type VerifiedSurveyStatus = "draft" | "published" | "paused" | "deleted" | "hard-deleted" | "reviewed" | "unknown";
export type VerifiedReviewStatus = "approved" | "reviewing" | "rejected" | "pending-real-name" | "unknown";

export interface PostVerificationResult {
  vid?: number;
  sid?: string;
  fillUrl?: string;
  editUrl?: string;
  status?: VerifiedSurveyStatus;
  verifyStatus?: VerifiedReviewStatus;
  verification: { structure: boolean; status: boolean; link: boolean };
  warnings: string[];
}

interface VerifyInput {
  vid: number;
  sid?: string;
  expectedTitle?: string;
  expectedQuestionCount?: number;
  expectedQtypes?: number[];
  /** JSONL qtype expectations; unknown names are reported and skipped. */
  expectedQuestionTypes?: readonly JsonlQuestionTypeExpectation[];
  /** Permit service-owned expansion/representation rows for unverifiable qtypes. */
  allowAdditionalQuestionRows?: boolean;
  expectedStatus?: VerifiedSurveyStatus;
  baseUrl?: string;
  respondentOrigins?: string[];
  credentials?: WjxCredentials;
  fetchImpl?: FetchLike;
  getSurveyFn?: (input: { vid: number; get_questions: boolean; get_items: boolean }, credentials?: WjxCredentials, fetchImpl?: FetchLike) => Promise<WjxApiResponse<any>>;
  listSurveysFn?: (input: { page_index: number; page_size: number }, credentials?: WjxCredentials, fetchImpl?: FetchLike) => Promise<WjxApiResponse<any>>;
}

const STATUS: Record<number, VerifiedSurveyStatus> = {
  0: "draft",
  1: "published",
  2: "paused",
  3: "deleted",
  4: "hard-deleted",
  5: "reviewed",
};
const VERIFY_STATUS: Record<number, VerifiedReviewStatus> = {
  1: "approved",
  2: "reviewing",
  3: "rejected",
  4: "pending-real-name",
};

// Public WJX deployments serve respondent pages from sibling domains (for
// example v.wjx.cn, tp.wjx.com, and ks.wjx.com) even when the OpenAPI base is
// www.wjx.cn. Keep the allowlist bounded to WJX-owned DNS families and retain
// the configured protocol/port so a read-back cannot redirect to an arbitrary
// origin.
const OFFICIAL_RESPONDENT_HOST_SUFFIXES = [
  ".wjx.cn",
  ".wjx.com",
  ".wjx.top",
  ".sojump.cn",
  ".sojump.com",
] as const;

function isOfficialRespondentHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  return OFFICIAL_RESPONDENT_HOST_SUFFIXES.some((suffix) =>
    host === suffix.slice(1) || host.endsWith(suffix));
}

function isAllowedRespondentOrigin(origin: string, configuredOrigins: Set<string>): boolean {
  if (configuredOrigins.has(origin)) return true;
  let candidate: URL;
  try { candidate = new URL(origin); } catch { return false; }
  if (!isOfficialRespondentHost(candidate.hostname)) return false;

  // A sibling public host is trusted only when it keeps the same transport
  // and port as one of the configured deployment origins.
  for (const configured of configuredOrigins) {
    try {
      const base = new URL(configured);
      if (
        base.protocol === candidate.protocol
        && base.port === candidate.port
        && isOfficialRespondentHost(base.hostname)
      ) return true;
    } catch {
      // Invalid configured origins are ignored; the exact-origin check above
      // remains the only path for a custom deployment value.
    }
  }
  return false;
}

function normalizeOrigin(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function normalizeSid(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const sid = value.trim();
  return sid && !/^\d+$/.test(sid) ? sid : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function asSurveyQuestions(data: Record<string, unknown>): Array<Record<string, unknown>> {
  for (const key of ["questions", "question", "items"]) {
    const value = data[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
    }
  }
  return [];
}

function respondentUrl(
  value: unknown,
  origins: Set<string>,
  vid: number,
  relativeOrigin?: string,
): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  let url: URL;
  try {
    url = new URL(value.trim(), relativeOrigin ? `${relativeOrigin}/` : undefined);
  } catch {
    return undefined;
  }
  if (!isAllowedRespondentOrigin(url.origin, origins) || !/^\/(?:vm|m|jq)(?:\/|$)/i.test(url.pathname)) return undefined;
  const lastSegment = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
  let publicId = lastSegment;
  try { publicId = decodeURIComponent(publicId); } catch { /* keep raw segment */ }
  publicId = publicId.replace(/\.aspx$/i, "");
  // A numeric path is a guessed vid route, even when it came from a malformed
  // server field. Respondent links must carry a short, non-numeric identifier.
  if (!publicId || /^\d+$/.test(publicId) || publicId === String(vid)) return undefined;
  return url.toString();
}

function editUrl(
  value: unknown,
  origins: Set<string>,
  relativeOrigin?: string,
): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  let url: URL;
  try {
    url = new URL(value.trim(), relativeOrigin ? `${relativeOrigin}/` : undefined);
  } catch {
    return undefined;
  }
  if (!origins.has(url.origin)) return undefined;
  // Keep the edit surface distinct from respondent routes. These prefixes are
  // the currently documented WJX management paths; unknown paths are omitted.
  if (!/^\/(?:newwjx|manage|edit|wjx)(?:\/|$)/i.test(url.pathname)) return undefined;
  return url.toString();
}

function field(record: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) if (record[name] !== undefined && record[name] !== null) return record[name];
  return undefined;
}

function activityRecords(data: Record<string, unknown>): Record<string, unknown>[] {
  const value = field(data, "activitys", "activities", "surveys");
  if (Array.isArray(value)) return value.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item));
  const map = asRecord(value);
  return map ? Object.values(map).map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item)) : [];
}

function recordMatchesVid(record: Record<string, unknown>, vid: number): boolean {
  const candidate = field(record, "vid", "activity", "id");
  return candidate !== undefined && String(candidate).trim() === String(vid);
}

async function findListRecord(input: VerifyInput, warnings: string[]): Promise<Record<string, unknown> | undefined> {
  const fetchList = input.listSurveysFn ?? ((args, credentials, fetchImpl) => listSurveys(args, credentials, fetchImpl));
  const pageSize = 50;
  let page = 1;
  let seen = 0;
  for (let iteration = 0; iteration < 100; iteration++, page++) {
    let response: WjxApiResponse<any>;
    try {
      response = await fetchList({ page_index: page, page_size: pageSize }, input.credentials, input.fetchImpl);
    } catch {
      warnings.push("survey list fallback could not read a matching record");
      return undefined;
    }
    if (response.result !== true || !asRecord(response.data)) {
      warnings.push("survey list fallback returned no verifiable data");
      return undefined;
    }
    const data = response.data as Record<string, unknown>;
    const records = activityRecords(data);
    const match = records.find((record) => recordMatchesVid(record, input.vid));
    if (match) return match;
    seen += records.length;
    const total = Number(field(data, "total_count", "totalCount"));
    if (!records.length || (Number.isFinite(total) && total > 0 && seen >= total) || records.length < pageSize) break;
  }
  warnings.push("survey list fallback did not contain the created survey");
  return undefined;
}

function resolveLinks(
  data: Record<string, unknown>,
  origins: Set<string>,
  vid: number,
): { fillUrl?: string; editUrl?: string; linkWarning?: string; hadFillFields: boolean } {
  const activityOrigin = normalizeOrigin(field(data, "activity_domain", "activityDomain", "respondent_domain"));
  const relativeOrigin = activityOrigin && isAllowedRespondentOrigin(activityOrigin, origins) ? activityOrigin : undefined;
  const fullFill = field(data, "fill_url", "fillUrl", "respondent_url", "respondentUrl");
  const paths = [field(data, "pc_path", "pcPath"), field(data, "mobile_path", "mobilePath"), field(data, "fill_path", "fillPath")];
  let fillUrl = respondentUrl(fullFill, origins, vid, relativeOrigin);
  if (!fillUrl) {
    for (const path of paths) {
      fillUrl = respondentUrl(path, origins, vid, relativeOrigin);
      if (fillUrl) break;
    }
  }
  const rawEdit = field(data, "edit_url", "editUrl", "edit_path", "editPath");
  const edit = editUrl(rawEdit, origins, relativeOrigin);
  const hasLinkField = fullFill !== undefined || paths.some((value) => value !== undefined);
  return {
    ...(fillUrl ? { fillUrl } : {}),
    ...(edit ? { editUrl: edit } : {}),
    ...(hasLinkField && !fillUrl ? { linkWarning: "server respondent link failed origin, route, or short-id validation" } : {}),
    hadFillFields: hasLinkField,
  };
}

export async function verifySurveyPostWrite(input: VerifyInput): Promise<PostVerificationResult> {
  const warnings: string[] = [];
  const base = getWjxBaseUrl(input.baseUrl);
  const origins = new Set<string>();
  const baseOrigin = normalizeOrigin(base);
  if (baseOrigin) origins.add(baseOrigin);
  for (const origin of input.respondentOrigins ?? []) {
    const normalized = normalizeOrigin(origin);
    if (normalized) origins.add(normalized);
  }
  const fetchSurvey = input.getSurveyFn ?? ((args, credentials, fetchImpl) => getSurvey(args, credentials, fetchImpl));
  let response: WjxApiResponse<any> | undefined;
  try {
    response = await fetchSurvey({ vid: input.vid, get_questions: true, get_items: true }, input.credentials, input.fetchImpl);
  } catch {
    warnings.push("read-after-write verification could not read survey state");
  }

  let data = response?.result === true ? asRecord(response.data) : undefined;
  // A successful create can be followed by a transient read failure. A single
  // bounded list lookup by the known vid gives us a safe recovery path without
  // replaying the write.
  if (!data) {
    const listed = await findListRecord(input, warnings);
    if (listed) data = listed;
  }
  if (!data) {
    if (!warnings.some((warning) => /could not read survey state/i.test(warning))) {
      warnings.push("read-after-write verification could not read survey state");
    }
    return { vid: input.vid, verification: { structure: false, status: false, link: false }, warnings };
  }

  const questions = asSurveyQuestions(data);
  const identityMatches = surveyIdentityMatches(data, input.vid);
  let structure = identityMatches;
  if (!identityMatches) warnings.push("read-after-write response identity differs from the requested survey id or is missing");
  const actualTitle = field(data, "title", "name", "survey_title");
  if (input.expectedTitle !== undefined && actualTitle !== input.expectedTitle) structure = false;
  if (input.expectedQuestionCount !== undefined) {
    const actualQuestionCount = filterJsonlVerificationQuestions(questions).length;
    const countMatches = input.allowAdditionalQuestionRows === true
      ? actualQuestionCount >= input.expectedQuestionCount
      : actualQuestionCount === input.expectedQuestionCount;
    if (!countMatches) structure = false;
  }
  if (input.expectedQuestionTypes) {
    const typeCheck = compareJsonlQuestionTypes(input.expectedQuestionTypes, questions, {
      allowAdditionalRows: input.allowAdditionalQuestionRows,
    });
    if (!typeCheck.matches) structure = false;
    warnings.push(...typeCheck.warnings);
  } else if (input.expectedQtypes) {
    const actual = questions.map((q) => field(q, "q_type", "qType")).map((q) => {
      if (typeof q === "number" && Number.isFinite(q)) return q;
      if (typeof q === "string" && /^-?\d+$/.test(q.trim())) return Number(q);
      return undefined;
    });
    if (actual.length !== input.expectedQtypes.length || actual.some((q, i) => q !== input.expectedQtypes![i])) structure = false;
  }
  if (!structure) warnings.push("verified survey structure differs from the requested input");

  const rawStatus = field(data, "status", "state", "status_code", "statusCode");
  const numericStatus = typeof rawStatus === "number"
    ? rawStatus
    : typeof rawStatus === "string" && /^\d+$/.test(rawStatus.trim()) ? Number(rawStatus) : undefined;
  const status = numericStatus !== undefined
    ? (STATUS[numericStatus] ?? "unknown")
    : typeof rawStatus === "string" && Object.values(STATUS).includes(rawStatus as VerifiedSurveyStatus)
      ? rawStatus as VerifiedSurveyStatus
      : "unknown";
  if (status === "unknown") warnings.push("survey status is not recognized from the read-back response");
  if (input.expectedStatus !== undefined && status !== input.expectedStatus) {
    warnings.push(`verified survey status differs from the requested status (expected ${input.expectedStatus}, got ${status})`);
  }
  const rawVerifyStatus = field(data, "verify_status", "verifyStatus", "review_status", "reviewStatus");
  const numericVerifyStatus = typeof rawVerifyStatus === "number"
    ? rawVerifyStatus
    : typeof rawVerifyStatus === "string" && /^\d+$/.test(rawVerifyStatus.trim()) ? Number(rawVerifyStatus) : undefined;
  const verifyStatus = numericVerifyStatus !== undefined
    ? (VERIFY_STATUS[numericVerifyStatus] ?? "unknown")
    : typeof rawVerifyStatus === "string" && Object.values(VERIFY_STATUS).includes(rawVerifyStatus as VerifiedReviewStatus)
      ? rawVerifyStatus as VerifiedReviewStatus
      : "unknown";
  if (verifyStatus === "unknown" && rawVerifyStatus !== undefined) {
    warnings.push("survey review status is not recognized from the read-back response");
  }
  let sid = normalizeSid(field(data, "sid", "short_id", "shortId")) ?? normalizeSid(input.sid);
  let links = resolveLinks(data, origins, input.vid);
  if (links.linkWarning) warnings.push(links.linkWarning);
  let fillUrl = links.fillUrl;
  // Prefer a caller-supplied list fallback before deriving a URL from sid. This
  // lets callers prove the sid/path pair from the same server record.
  if (!fillUrl && (input.listSurveysFn || !sid)) {
    const listed = await findListRecord(input, warnings);
    if (listed) {
      const listedSid = normalizeSid(field(listed, "sid", "short_id", "shortId"));
      if (listedSid) sid = listedSid;
      const listedLinks = resolveLinks(listed, origins, input.vid);
      if (listedLinks.linkWarning) warnings.push(listedLinks.linkWarning);
      links = {
        ...links,
        fillUrl: listedLinks.fillUrl,
        editUrl: listedLinks.editUrl ?? links.editUrl,
        hadFillFields: links.hadFillFields || listedLinks.hadFillFields,
      };
      fillUrl = listedLinks.fillUrl;
    }
  }
  // A malformed/cross-origin server link must not be silently replaced by a
  // sid-derived URL; doing so would hide the fact that the server response was
  // not trustworthy. Sid derivation remains compatible when no link field was
  // supplied at all.
  if (!fillUrl && sid && !links.hadFillFields) {
    try { fillUrl = buildPreviewUrl({ sid, vid: input.vid, allowVidFallback: false }, base); }
    catch { warnings.push("verified respondent sid/link is unavailable"); }
  }
  if (!fillUrl) warnings.push("no verified respondent link was returned; numeric vid was not used as a public URL");
  return {
    vid: input.vid,
    ...(sid ? { sid } : {}),
    ...(fillUrl ? { fillUrl } : {}),
    ...(links.editUrl ? { editUrl: links.editUrl } : {}),
    status,
    ...(verifyStatus !== "unknown" ? { verifyStatus } : {}),
    verification: {
      structure,
      status: status !== "unknown" && (input.expectedStatus === undefined || status === input.expectedStatus),
      link: Boolean(fillUrl),
    },
    warnings,
  };
}
