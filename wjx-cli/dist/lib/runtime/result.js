export function success(data, meta) {
    return meta && Object.keys(meta).length > 0 ? { ok: true, data, meta } : { ok: true, data };
}
export function problem(error) {
    return { ok: false, error };
}
//# sourceMappingURL=result.js.map