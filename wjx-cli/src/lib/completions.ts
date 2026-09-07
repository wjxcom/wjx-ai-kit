import type { Command } from "commander";

/**
 * Static shell snippets used by the completion command.
 *
 * Keep this module free of runtime dependencies so `wjx completion <shell>`
 * can answer without loading the full Commander command graph or API SDK.
 */
export const COMPLETION_SCRIPTS = Object.freeze({
  bash: `
_wjx_completions() {
  local cur_word="\${COMP_WORDS[COMP_CWORD]}"
  local line="\${COMP_LINE}"
  local point="\${COMP_POINT}"

  local candidates
  candidates=$(wjx --get-completions "$point" "$line" 2>/dev/null)

  COMPREPLY=($(compgen -W "$candidates" -- "$cur_word"))
}

complete -F _wjx_completions wjx
`.trim(),
  zsh: `
_wjx_completions() {
  local line="\${words[*]}"
  local point="\${CURSOR}"

  local candidates
  candidates=("\${(@f)$(wjx --get-completions "$point" "$line" 2>/dev/null)}")

  local -a completions
  for c in "\${candidates[@]}"; do
    [[ -n "$c" ]] && completions+=("$c")
  done
  _describe 'wjx' completions
}

compdef _wjx_completions wjx
`.trim(),
  fish: `
complete -c wjx -f -a '(wjx --get-completions (commandline -C) (commandline) 2>/dev/null)'
`.trim(),
} as const);

export type CompletionShell = keyof typeof COMPLETION_SCRIPTS;

export function getCompletionScript(shell: string): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(COMPLETION_SCRIPTS, shell)) return undefined;
  return COMPLETION_SCRIPTS[shell as CompletionShell];
}

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
