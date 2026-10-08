export async function collectPages(strategy, options = {}) {
    const maxPages = Math.max(1, Math.min(options.pageLimit ?? 100, 1000));
    const maxItems = Math.max(1, Math.min(options.maxItems ?? 100_000, 1_000_000));
    const all = [];
    let page = { ...strategy.initial };
    let pages = 0;
    let nextToken;
    let complete = false;
    while (true) {
        if (options.signal?.aborted)
            throw new Error("Pagination cancelled");
        const result = await strategy.fetch(page);
        pages += 1;
        all.push(...result.items);
        if (all.length > maxItems)
            throw new Error(`Pagination exceeded max items (${maxItems})`);
        if (!options.pageAll || result.complete === true || pages >= maxPages) {
            complete = result.complete !== false;
            break;
        }
        nextToken = result.nextToken;
        const next = strategy.next?.(page, result);
        if (!next || (nextToken === undefined && result.complete !== false)) {
            complete = true;
            break;
        }
        page = next;
    }
    return { items: all, meta: { complete, pages, items: all.length, next_token: nextToken } };
}
//# sourceMappingURL=pagination.js.map