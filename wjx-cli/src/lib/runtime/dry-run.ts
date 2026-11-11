import type { RequestPlan } from "./types.js";
import { redactJson } from "../mask.js";

export interface DryRunResult {
  kind: "dry-run";
  plans: RequestPlan[];
}

export function renderDryRun(plans: RequestPlan[]): DryRunResult {
  return { kind: "dry-run", plans: plans.map((plan) => ({
    ...plan,
    headers: { ...plan.headers },
    body: redactJson(plan.body),
    unresolved: plan.unresolved ? [...plan.unresolved] : undefined,
  })) };
}
