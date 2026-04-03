import { Command } from "commander";
import { homedir } from "node:os";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CliError, handleError } from "../lib/errors.js";

const BASH_SCRIPT = `
_wjx_completions() {
  local cur_word="\${COMP_WORDS[COMP_CWORD]}"
  local line="\${COMP_LINE}"
  local point="\${COMP_POINT}"

  local candidates
  candidates=$(wjx --get-completions "$point" "$line" 2>/dev/null)

  COMPREPLY=($(compgen -W "$candidates" -- "$cur_word"))
}

complete -F _wjx_completions wjx
`.trim();

const ZSH_SCRIPT = `
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
`.trim();

const FISH_SCRIPT = `
complete -c wjx -f -a '(wjx --get-completions (commandline -C) (commandline) 2>/dev/null)'
`.trim();

const PROFILE_FILES: Record<string, string> = {
  bash: ".bashrc",
  zsh: ".zshrc",
  fish: join(".config", "fish", "config.fish"),
};

const EVAL_LINES: Record<string, string> = {
  bash: 'eval "$(wjx completion bash)"',
  zsh: 'eval "$(wjx completion zsh)"',
  fish: "wjx completion fish | source",
};

function detectShell(): string | null {
  const shell = process.env.SHELL || "";
  if (shell.includes("zsh")) return "zsh";
  if (shell.includes("bash")) return "bash";
  if (shell.includes("fish")) return "fish";
  return null;
}

export function registerCompletionCommands(program: Command): void {
  const completion = program
    .command("completion")
    .description("生成 Shell 自动补全脚本");

  completion
    .command("bash")
    .description("输出 Bash 补全脚本")
    .action(() => {
      console.log(BASH_SCRIPT);
    });

  completion
    .command("zsh")
    .description("输出 Zsh 补全脚本")
    .action(() => {
      console.log(ZSH_SCRIPT);
    });

  completion
    .command("fish")
    .description("输出 Fish 补全脚本")
    .action(() => {
      console.log(FISH_SCRIPT);
    });

  completion
    .command("install")
    .description("自动安装补全脚本到 Shell 配置文件")
    .action(() => {
      try {
        const shell = detectShell();
        if (!shell) {
          throw new CliError(
            "INPUT_ERROR",
            "无法检测 Shell 类型。请手动运行:\n" +
            "  Bash: eval \"$(wjx completion bash)\"\n" +
            "  Zsh:  eval \"$(wjx completion zsh)\"\n" +
            "  Fish: wjx completion fish | source",
          );
        }

        const profilePath = join(homedir(), PROFILE_FILES[shell]);
        const evalLine = EVAL_LINES[shell];
        const marker = "# wjx shell completions";

        // Check for existing installation
        try {
          if (existsSync(profilePath)) {
            const content = readFileSync(profilePath, "utf8");
            if (content.includes(evalLine) || content.includes("wjx completion")) {
              process.stderr.write(`补全脚本已安装在 ${profilePath}\n`);
              return;
            }
          }
        } catch {
          // Profile unreadable — proceed to append
        }

        const isNew = !existsSync(profilePath);
        const snippet = `\n${marker}\n${evalLine}\n`;
        writeFileSync(profilePath, snippet, { flag: "a" });
        if (isNew) {
          process.stderr.write(`已创建新文件 ${profilePath}\n`);
        }
        process.stderr.write(`已添加到 ${profilePath}\n`);
        process.stderr.write(`运行以下命令立即生效:\n  source ${profilePath}\n`);
      } catch (e) {
        handleError(e);
      }
    });
}
