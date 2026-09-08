import type { Command } from "commander";
/**
 * Static shell snippets used by the completion command.
 *
 * Keep this module free of runtime dependencies so `wjx completion <shell>`
 * can answer without loading the full Commander command graph or API SDK.
 */
export declare const COMPLETION_SCRIPTS: Readonly<{
    readonly bash: string;
    readonly zsh: string;
    readonly fish: string;
}>;
export type CompletionShell = keyof typeof COMPLETION_SCRIPTS;
export declare function getCompletionScript(shell: string): string | undefined;
/**
 * Walk the Commander command tree and return completion candidates
 * for the given input line and cursor position.
 */
export declare function getCompletions(program: Command, point: number, line: string): string[];
