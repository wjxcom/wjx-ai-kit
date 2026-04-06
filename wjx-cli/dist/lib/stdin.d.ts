import type { Command } from "commander";
/**
 * Read JSON from stdin. Returns parsed object or empty object if no data.
 */
export declare function readStdin(): Promise<Record<string, unknown>>;
/**
 * Source-aware merge: stdin as base, only CLI-explicit args override.
 * Uses Commander's getOptionValueSource() to distinguish user input from defaults.
 */
export declare function mergeStdinWithOpts(stdinData: Record<string, unknown>, command: Command): Record<string, unknown>;
