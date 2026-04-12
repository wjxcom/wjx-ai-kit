import { AsyncLocalStorage } from "node:async_hooks";
/**
 * Per-request credential store.
 *
 * In HTTP multi-tenant mode, the transport layer extracts credentials from
 * the incoming request (e.g. Basic auth header) and runs the MCP handler
 * inside `credentialStore.run(creds, fn)`.  Downstream code (api-client,
 * SSO client, …) calls `getRequestCredentials()` to retrieve them.
 *
 * In stdio mode (single-tenant) this store is never populated and
 * callers fall back to environment variables — fully backward-compatible.
 */
export const credentialStore = new AsyncLocalStorage();
/** Return request-scoped credentials, or `undefined` if not in an HTTP context. */
export function getRequestCredentials() {
    return credentialStore.getStore();
}
//# sourceMappingURL=context.js.map