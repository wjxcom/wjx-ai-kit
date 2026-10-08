import type { VerifyWjxDslWriteInput, VerifyWjxDslWriteResult } from "./types.js";
/** Read back the canonical DSL after a write and verify identity, structure, status and link fields. */
export declare function verifyWjxDslWrite(input: VerifyWjxDslWriteInput): Promise<VerifyWjxDslWriteResult>;
