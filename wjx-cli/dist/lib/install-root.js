import { existsSync } from "node:fs";
import { resolve } from "node:path";
/** 已知客户端的环境变量探测顺序（先到先得） */
const CLIENT_ENV_VARS = [
    { name: "CLAUDE_PROJECT_DIR", source: "env:CLAUDE_PROJECT_DIR" },
    { name: "WORKBUDDY_HOME", source: "env:WORKBUDDY_HOME" },
    { name: "CLAW_HOME", source: "env:CLAW_HOME" },
];
export function resolveInstallRoot(options = {}) {
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
//# sourceMappingURL=install-root.js.map