export type SurveyIdentityState = "match" | "mismatch" | "missing";

type SurveyRecord = Record<string, unknown>;

function numericIdentity(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : undefined;
  }
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return undefined;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Inspect all identity aliases returned by survey endpoints. A response is
 * considered present only when at least one alias is explicit; contradictory
 * aliases are treated as a mismatch rather than choosing one arbitrarily.
 */
export function surveyIdentityState(data: SurveyRecord | undefined, vid: number): SurveyIdentityState {
  if (!data) return "missing";
  const identities: number[] = [];
  for (const key of ["vid", "activity", "activity_id", "activityId", "activityid", "id"]) {
    const value = data[key];
    if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) continue;
    const identity = numericIdentity(value);
    if (identity === undefined) return "mismatch";
    identities.push(identity);
  }
  if (identities.length === 0) return "missing";
  return identities.every((value) => value === vid) ? "match" : "mismatch";
}

/** Strict identity guard for read-backs that must be tied to a target survey. */
export function surveyIdentityMatches(data: SurveyRecord | undefined, vid: number): boolean {
  return surveyIdentityState(data, vid) === "match";
}
