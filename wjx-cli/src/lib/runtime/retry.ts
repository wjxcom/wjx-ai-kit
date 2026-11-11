export interface RetryPolicy { retryBudget?: number; maxRetries?: number; }

export function normalizeRetryPolicy(policy: RetryPolicy = {}) {
  const budget = policy.retryBudget ?? policy.maxRetries ?? 3;
  if (!Number.isSafeInteger(budget) || budget < 0 || budget > 10_000) throw new Error("retryBudget must be an integer between 0 and 10000");
  return { retryBudget: budget, maxRetries: budget };
}
