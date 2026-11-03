import type { InputContext, NormalizedInput } from "./types.js";
export declare function mergeInputSources(stdin?: Record<string, unknown>, cli?: Record<string, unknown>, explicitCli?: Iterable<string>): Record<string, unknown>;
export declare function normalizeInput(context: InputContext): NormalizedInput;
