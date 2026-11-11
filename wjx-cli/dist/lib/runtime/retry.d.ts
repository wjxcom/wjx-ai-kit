export interface RetryPolicy {
    retryBudget?: number;
    maxRetries?: number;
}
export declare function normalizeRetryPolicy(policy?: RetryPolicy): {
    retryBudget: number;
    maxRetries: number;
};
