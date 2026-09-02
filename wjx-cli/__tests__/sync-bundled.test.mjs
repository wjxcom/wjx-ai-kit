import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  syncDir,
  syncFile,
  countSourceFiles,
  shouldExclude,
} from "../scripts/sync-bundled.mjs";

const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, "..", "scripts", "sync-bundled.mjs");

/** Build a test fixture: wjx-skills-like dir structure. */
function makeFixture(root) {
  const src = resolve(root, "src-skill");
  const dest = resolve(root, "dest-skill");
  mkdirSync(src, { recursive: true });
  mkdirSync(join(src, "references"), { recursive: true });
  mkdirSync(join(src, "__pycache__"), { recursive: true });
  writeFileSync(join(src, "SKILL.md"), "# skill\n");
  writeFileSync(join(src, "references", "guide.md"), "# guide\n");
  writeFileSync(join(src, "references", "another.md"), "# another\n");
  writeFileSync(join(src, "__pycache__", "skip.pyc"), "binary");
  writeFileSync(join(src, ".gitignore"), "node_modules/\n");
  return { src, dest };
}

function listRel(dir) {
  const out = [];
  function walk(d, prefix = "") {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(join(d, entry.name), rel);
      else out.push(rel);
    }
  }
  if (existsSync(dir)) walk(dir);
  return out.sort();
}

describe("sync-bundled", () => {
  const TMP = resolve(__dirname, "__tmp_sync_bundled__");

  before(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });
  after(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("shouldExclude 命中 exclude 数组", () => {
    assert.strictEqual(shouldExclude("__pycache__", { exclude: ["__pycache__"] }), true);
    assert.strictEqual(shouldExclude("README.md", { exclude: ["__pycache__"] }), false);
  });

  it("shouldExclude 命中 excludePatterns 正则", () => {
    const target = { excludePatterns: [/^ws-/, /\.pyc$/] };
    assert.strictEqual(shouldExclude("ws-93913", target), true);
    assert.strictEqual(shouldExclude("foo.pyc", target), true);
    assert.strictEqual(shouldExclude("foo.py", target), false);
  });

  it("countSourceFiles 排除掉 __pycache__ 和 .gitignore", () => {
    const { src } = makeFixture(resolve(TMP, "count"));
    const target = { exclude: ["__pycache__", ".gitignore"] };
    // 期望：SKILL.md + 2 references = 3（pyc + .gitignore 排除）
    assert.strictEqual(countSourceFiles(src, target), 3);
  });

  it("syncDir 复制 + 排除 + 幂等", () => {
    const { src, dest } = makeFixture(resolve(TMP, "syncdir"));
    const target = {
      name: "test-skill",
      src,
      dest,
      exclude: ["__pycache__", ".gitignore"],
    };
    syncDir(target);
    // 第一次结果
    const first = listRel(dest);
    assert.deepStrictEqual(first, [
      "SKILL.md",
      "references/another.md",
      "references/guide.md",
    ], "首次 sync 结果不符合预期");

    // 模拟 dest 里残留旧文件
    writeFileSync(join(dest, "STALE.md"), "old\n");
    syncDir(target);
    const second = listRel(dest);
    assert.deepStrictEqual(second, first, "第二次 sync 应该清掉 STALE.md");
  });

  it("syncFile 复制单文件", () => {
    const root = resolve(TMP, "syncfile");
    mkdirSync(root, { recursive: true });
    const src = resolve(root, "agent.md");
    const dest = resolve(root, "out", "bundled", "agent.md");
    writeFileSync(src, "agent content\n");

    syncFile({ name: "agent.md", src, dest });
    assert.strictEqual(readFileSync(dest, "utf8"), "agent content\n");
  });

  it("CLI 调用：source 仅 1 文件触发 abort（保护 bundled）", async () => {
    const root = resolve(TMP, "guard");
    const src = resolve(root, "src-too-small");
    const dest = resolve(root, "dest-keep");
    mkdirSync(src, { recursive: true });
    mkdirSync(dest, { recursive: true });
    writeFileSync(join(src, "ONLY.md"), "lonely\n");
    writeFileSync(join(dest, "important.md"), "must-survive\n");

    // 直接调内部 fn 走护栏分支会 process.exit(1)，所以走子进程检验
    const scriptUrl = pathToFileURL(SCRIPT).href;
    const harness = `
      import { syncDir } from ${JSON.stringify(scriptUrl)};
      syncDir({
        name: "fixture",
        src: ${JSON.stringify(src)},
        dest: ${JSON.stringify(dest)},
        exclude: [],
      });
    `;
    const harnessPath = resolve(root, "harness.mjs");
    writeFileSync(harnessPath, harness);

    let exitCode = 0;
    let stderr = "";
    try {
      await execFileP("node", [harnessPath], { timeout: 10_000 });
    } catch (e) {
      exitCode = e.code ?? 1;
      stderr = e.stderr || "";
    }
    assert.strictEqual(exitCode, 1, "应该 exit 1");
    assert.match(stderr, /拒绝执行|< 3/, "stderr 应说明拒绝原因");
    assert.ok(
      readFileSync(join(dest, "important.md"), "utf8") === "must-survive\n",
      "护栏触发后 dest 应被保留",
    );
  });
});
