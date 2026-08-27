import type { RequestPlan } from "./types.js";

export interface DryRunResult {
  dry_run: true;
  plans: RequestPlan[];
}

export function renderDryRun(plans: RequestPlan[]): DryRunResult {
  return { dry_run: true, plans: plans.map((plan) => ({
    ...plan,
    headers: { ...plan.headers },
    unresolved: plan.unresolved ? [...plan.unresolved] : undefined,
  })) };
}

