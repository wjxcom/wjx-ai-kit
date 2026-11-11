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
export type InstallRootSource = "target-dir" | "env:WJX_INSTALL_ROOT" | "env:CLAUDE_PROJECT_DIR" | "env:WORKBUDDY_HOME" | "env:CLAW_HOME" | "cwd";
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
export declare function resolveInstallRoot(options?: ResolveInstallRootOptions): ResolvedInstallRoot;
