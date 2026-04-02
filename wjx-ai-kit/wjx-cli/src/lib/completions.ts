import type { Command } from "commander";

/**
 * Walk the Commander command tree and return completion candidates
 * for the given input line and cursor position.
 */
export function getCompletions(program: Command, point: number, line: string): string[] {
  const partial = line.slice(0, point);
  const tokens = partial.trim().split(/\s+/).slice(1); // drop "wjx"

  // If line ends with space, user wants next token; otherwise last token is partial
  const endsWithSpace = partial.endsWith(" ");
  const partialWord = endsWithSpace ? "" : (tokens.pop() ?? "");

  let currentCmd: Command = program;
  for (const tok of tokens) {
    const sub = currentCmd.commands.find((c: Command) => c.name() === tok);
    if (sub) {
      currentCmd = sub;
    } else {
      break;
    }
  }

  const candidates: string[] = [];

  if (partialWord.startsWith("-")) {
    // Complete options
    for (const opt of currentCmd.options) {
      if (opt.long) candidates.push(opt.long);
      else if (opt.short) candidates.push(opt.short);
    }
    // Walk the full parent chain to include global options
    let p = currentCmd.parent;
    while (p) {
      for (const opt of p.options) {
        if (opt.long) candidates.push(opt.long);
      }
      p = p.parent;
    }
  } else {
    // Complete subcommand names
    for (const sub of currentCmd.commands) {
      candidates.push(sub.name());
    }
  }

  // Filter by prefix
  return candidates.filter((c) => c.startsWith(partialWord));
}
