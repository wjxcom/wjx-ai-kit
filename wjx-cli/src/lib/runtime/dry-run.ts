import type { RequestPlan } from "./types.js";

export interface DryRunResult {
  kind: "dry-run";
  plans: RequestPlan[];
}

export function renderDryRun(plans: RequestPlan[]): DryRunResult {
  return { kind: "dry-run", plans: plans.map((plan) => ({
    ...plan,
    headers: { ...plan.headers },
    unresolved: plan.unresolved ? [...plan.unresolved] : undefined,
  })) };
}
