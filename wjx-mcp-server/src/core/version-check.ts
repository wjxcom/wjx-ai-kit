import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REGISTRY_URL = "https://registry.npmjs.org/wjx-mcp-server/latest";
const TIMEOUT_MS = 3000;

function readCurrentVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkgPath = resolve(__dirname, "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return String(pkg.version || "");
  } catch {
    return "";
  }
}

function compareSemver(a: string, b: string): number {
  const pa = a.split("-")[0].split(".").map((n) => Number.parseInt(n, 10));
  const pb = b.split("-")[0].split(".").map((n) => Number.parseInt(n, 10));
  for (let i = 0; i < 3; i++) {
    const ai = pa[i] ?? 0;
    const bi = pb[i] ?? 0;
    if (Number.isNaN(ai) || Number.isNaN(bi)) return 0;
    if (ai !== bi) return ai < bi ? -1 : 1;
  }
  return 0;
}

export function checkLatestVersion(): void {
  if (process.env.WJX_DISABLE_VERSION_CHECK === "1") return;
  const current = readCurrentVersion();
  if (!current) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  fetch(REGISTRY_URL, { signal: controller.signal })
    .then(async (res) => {
      if (!res.ok) return;
      const meta = (await res.json()) as { version?: string };
      const latest = meta.version;
      if (!latest || typeof latest !== "string") return;
      if (compareSemver(current, latest) < 0) {
        console.error(
          `[wjx-mcp-server] 新版本可用：${latest}（当前 ${current}）。请重启 MCP 客户端以加载新版；config 已使用 npx -y wjx-mcp-server@latest 时无需手动清缓存。设置 WJX_DISABLE_VERSION_CHECK=1 可关闭此提示。`,
        );
      }
    })
    .catch(() => {
      /* offline / blocked / timeout — silent */
    })
    .finally(() => clearTimeout(timer));
}
