import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 调 wjx skill 的客户端（workbuddy / claw / Claude Code / 编程 IDE）家目录不同，
 * 但 skill + agent 必须装在**同一个根**下面（之前 agent 跳到 ~/.claude/ 是 bug）。
 *
 * 解析优先级（高 → 低）：
 *   1. --target-dir <path>            （AI Agent / 脚本显式指定）
 *   2. WJX_INSTALL_ROOT 环境变量      （配置时一次性绑定）
 *   3. 已知客户端环境变量            （workbuddy / Claude Code / claw 各自传）
 *   4. process.cwd()                  （兜底，纯 CLI 调用默认值）
 */

export type InstallRootSource =
  | "target-dir"
  | "env:WJX_INSTALL_ROOT"
  | "env:CLAUDE_PROJECT_DIR"
  | "env:WORKBUDDY_HOME"
  | "env:CLAW_HOME"
  | "cwd";

export interface ResolveInstallRootOptions {
  /** --target-dir 命令行参数显式指定的目录 */
  targetDir?: string;
  /** 用于测试：覆盖默认 process.env（生产代码请勿传） */
  env?: NodeJS.ProcessEnv;
  /** 用于测试：覆盖默认 process.cwd（生产代码请勿传） */
  cwd?: () => string;
}

export interface ResolvedInstallRoot {
  /** 绝对路径，install/update 的目标根目录 */
  root: string;
  /** 来源标签，用于日志展示 "Install root: <root> (from: <source>)" */
  source: InstallRootSource;
}

/** 已知客户端的环境变量探测顺序（先到先得） */
const CLIENT_ENV_VARS: ReadonlyArray<{
  name: string;
  source: InstallRootSource;
}> = [
  { name: "CLAUDE_PROJECT_DIR", source: "env:CLAUDE_PROJECT_DIR" },
  { name: "WORKBUDDY_HOME", source: "env:WORKBUDDY_HOME" },
  { name: "CLAW_HOME", source: "env:CLAW_HOME" },
];

export function resolveInstallRoot(
  options: ResolveInstallRootOptions = {},
): ResolvedInstallRoot {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd;

  // 1. --target-dir 显式指定
  if (options.targetDir && options.targetDir.trim()) {
    return { root: resolve(options.targetDir.trim()), source: "target-dir" };
  }

  // 2. WJX_INSTALL_ROOT 环境变量
  const wjxRoot = env.WJX_INSTALL_ROOT?.trim();
  if (wjxRoot) {
    return { root: resolve(wjxRoot), source: "env:WJX_INSTALL_ROOT" };
  }

  // 3. 已知客户端探测
  for (const probe of CLIENT_ENV_VARS) {
    const value = env[probe.name]?.trim();
    if (value && existsSync(value)) {
      return { root: resolve(value), source: probe.source };
    }
  }

  // 4. 兜底 cwd
  return { root: resolve(cwd()), source: "cwd" };
}
