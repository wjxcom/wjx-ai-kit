export function mergeInputSources(stdin = {}, cli = {}, explicitCli = Object.keys(cli)) {
    const merged = { ...stdin, ...cli };
    const explicit = new Set(explicitCli);
    for (const key of Object.keys(cli)) {
        if (!explicit.has(key) && key in stdin)
            merged[key] = stdin[key];
    }
    return merged;
}
export function normalizeInput(context) {
    const values = { ...(context.defaults ?? {}), ...context.values };
    const source = { ...(context.source ?? {}) };
    for (const key of Object.keys(values))
        source[key] ??= "input";
    return { values, source, unknown: [] };
}
//# sourceMappingURL=input.js.map