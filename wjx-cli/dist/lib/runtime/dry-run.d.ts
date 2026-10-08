import type { RequestPlan } from "./types.js";
export interface DryRunResult {
    kind: "dry-run";
    plans: RequestPlan[];
}
export declare function renderDryRun(plans: RequestPlan[]): DryRunResult;
