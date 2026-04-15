import type { Command } from "commander";
/**
 * Walk the Commander command tree and return completion candidates
 * for the given input line and cursor position.
 */
export declare function getCompletions(program: Command, point: number, line: string): string[];
