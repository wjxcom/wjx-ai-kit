import { redactJson } from "../mask.js";
export function renderDryRun(plans) {
    return { kind: "dry-run", plans: plans.map((plan) => ({
            ...plan,
            headers: { ...plan.headers },
            body: redactJson(plan.body),
            unresolved: plan.unresolved ? [...plan.unresolved] : undefined,
        })) };
}
//# sourceMappingURL=dry-run.js.map