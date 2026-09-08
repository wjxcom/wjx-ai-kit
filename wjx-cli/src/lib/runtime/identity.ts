export type SurveyIdentityState = "match" | "mismatch" | "missing";

type SurveyRecord = Record<string, unknown>;

const SURVEY_IDENTITY_FIELDS = ["vid", "activity", "activity_id", "activityId", "activityid", "id"] as const;

function numericIdentity(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : undefined;
  }
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return undefined;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function isProvided(value: unknown): boolean {
  return value !== undefined && value !== null && !(typeof value === "string" && value.trim() === "");
}

/**
 * Require an explicit, consistent survey identity for safety-sensitive reads.
 * Empty aliases are treated as omitted; any other malformed alias is a
 * mismatch so a valid sibling alias cannot mask corrupt response data.
 */
export function surveyIdentityState(data: SurveyRecord | undefined, vid: number): SurveyIdentityState {
  if (!data) return "missing";
  const identities: number[] = [];
  for (const field of SURVEY_IDENTITY_FIELDS) {
    const value = data[field];
    if (!isProvided(value)) continue;
    const identity = numericIdentity(value);
    if (identity === undefined) return "mismatch";
    identities.push(identity);
  }
  if (identities.length === 0) return "missing";
  return identities.every((identity) => identity === vid) ? "match" : "mismatch";
}

export function surveyIdentityMatches(data: SurveyRecord | undefined, vid: number): boolean {
  return surveyIdentityState(data, vid) === "match";
}
