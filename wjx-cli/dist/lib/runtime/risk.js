const RISK_ORDER = {
    read: 0,
    write: 1,
    "high-risk-write": 2,
};
export function compareRisk(left, right) {
    return RISK_ORDER[left] - RISK_ORDER[right];
}
export function requiresConfirmation(spec, invocation = {}) {
    return spec.risk === "high-risk-write" && invocation.dryRun !== true;
}
//# sourceMappingURL=risk.js.map