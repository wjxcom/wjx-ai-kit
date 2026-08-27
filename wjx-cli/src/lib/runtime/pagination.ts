export interface PageResult<T> {
  items: T[];
  nextToken?: string;
  complete?: boolean;
}

export interface PageStrategy<T> {
  initial: Record<string, unknown>;
  fetch(page: Record<string, unknown>): Promise<PageResult<T>>;
  next?(page: Record<string, unknown>, result: PageResult<T>): Record<string, unknown> | undefined;
}

export interface PaginationOptions { pageAll?: boolean; pageLimit?: number; maxItems?: number; signal?: AbortSignal; }

export async function collectPages<T>(strategy: PageStrategy<T>, options: PaginationOptions = {}) {
  const maxPages = Math.max(1, Math.min(options.pageLimit ?? 100, 1000));
  const maxItems = Math.max(1, Math.min(options.maxItems ?? 100_000, 1_000_000));
  const all: T[] = [];
  let page = { ...strategy.initial };
  let pages = 0;
  let nextToken: string | undefined;
  let complete = false;
  while (true) {
    if (options.signal?.aborted) throw new Error("Pagination cancelled");
    const result = await strategy.fetch(page);
    pages += 1;
    all.push(...result.items);
    if (all.length > maxItems) throw new Error(`Pagination exceeded max items (${maxItems})`);
    if (!options.pageAll || result.complete === true || pages >= maxPages) { complete = result.complete !== false; break; }
    nextToken = result.nextToken;
    const next = strategy.next?.(page, result);
    if (!next || (nextToken === undefined && result.complete !== false)) { complete = true; break; }
    page = next;
  }
  return { items: all, meta: { complete, pages, items: all.length, next_token: nextToken } };
}
