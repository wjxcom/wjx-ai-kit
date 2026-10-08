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
export interface PaginationOptions {
    pageAll?: boolean;
    pageLimit?: number;
    maxItems?: number;
    signal?: AbortSignal;
}
export declare function collectPages<T>(strategy: PageStrategy<T>, options?: PaginationOptions): Promise<{
    items: T[];
    meta: {
        complete: boolean;
        pages: number;
        items: number;
        next_token: string | undefined;
    };
}>;
