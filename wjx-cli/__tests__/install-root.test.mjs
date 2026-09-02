import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveInstallRoot } from "../dist/lib/install-root.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP = resolve(__dirname, "__tmp_install_root__");

const FAKE_WORKBUDDY = resolve(TMP, "workbuddy");
const FAKE_CLAUDE = resolve(TMP, "claude-proj");
const FAKE_CLAW = resolve(TMP, "claw");
const FAKE_TARGET = resolve(TMP, "explicit-target");

before(() => {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(FAKE_WORKBUDDY, { recursive: true });
  mkdirSync(FAKE_CLAUDE, { recursive: true });
  mkdirSync(FAKE_CLAW, { recursive: true });
  mkdirSync(FAKE_TARGET, { recursive: true });
});

after(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("resolveInstallRoot", () => {
  it("--target-dir 优先级最高，压过所有 env", () => {
    const r = resolveInstallRoot({
      targetDir: FAKE_TARGET,
      env: {
        WJX_INSTALL_ROOT: FAKE_WORKBUDDY,
        CLAUDE_PROJECT_DIR: FAKE_CLAUDE,
        WORKBUDDY_HOME: FAKE_WORKBUDDY,
        CLAW_HOME: FAKE_CLAW,
      },
      cwd: () => "/should/not/be/used",
    });
    assert.strictEqual(r.root, FAKE_TARGET);
    assert.strictEqual(r.source, "target-dir");
  });

  it("WJX_INSTALL_ROOT 次之，压过客户端 env", () => {
    const r = resolveInstallRoot({
      env: {
        WJX_INSTALL_ROOT: FAKE_TARGET,
        CLAUDE_PROJECT_DIR: FAKE_CLAUDE,
        WORKBUDDY_HOME: FAKE_WORKBUDDY,
      },
      cwd: () => "/should/not/be/used",
    });
    assert.strictEqual(r.root, FAKE_TARGET);
    assert.strictEqual(r.source, "env:WJX_INSTALL_ROOT");
  });

  it("CLAUDE_PROJECT_DIR 命中（且目录存在）", () => {
    const r = resolveInstallRoot({
      env: {
        CLAUDE_PROJECT_DIR: FAKE_CLAUDE,
        WORKBUDDY_HOME: FAKE_WORKBUDDY,
      },
      cwd: () => "/should/not/be/used",
    });
    assert.strictEqual(r.root, FAKE_CLAUDE);
    assert.strictEqual(r.source, "env:CLAUDE_PROJECT_DIR");
  });

  it("WORKBUDDY_HOME 在 CLAUDE_PROJECT_DIR 缺失时命中", () => {
    const r = resolveInstallRoot({
      env: { WORKBUDDY_HOME: FAKE_WORKBUDDY },
      cwd: () => "/should/not/be/used",
    });
    assert.strictEqual(r.root, FAKE_WORKBUDDY);
    assert.strictEqual(r.source, "env:WORKBUDDY_HOME");
  });

  it("CLAW_HOME 在前两者都缺失时命中", () => {
    const r = resolveInstallRoot({
      env: { CLAW_HOME: FAKE_CLAW },
      cwd: () => "/should/not/be/used",
    });
    assert.strictEqual(r.root, FAKE_CLAW);
    assert.strictEqual(r.source, "env:CLAW_HOME");
  });

  it("env 指向不存在路径时跳过（不挂在死路径上）", () => {
    const r = resolveInstallRoot({
      env: {
        CLAUDE_PROJECT_DIR: resolve(TMP, "nonexistent-claude"),
        WORKBUDDY_HOME: FAKE_WORKBUDDY,
      },
      cwd: () => "/should/not/be/used",
    });
    assert.strictEqual(r.root, FAKE_WORKBUDDY);
    assert.strictEqual(r.source, "env:WORKBUDDY_HOME");
  });

  it("空字符串 / 仅空白 不算指定", () => {
    const r = resolveInstallRoot({
      targetDir: "   ",
      env: { WJX_INSTALL_ROOT: "" },
      cwd: () => FAKE_TARGET,
    });
    assert.strictEqual(r.root, FAKE_TARGET);
    assert.strictEqual(r.source, "cwd");
  });

  it("全空时兜底 cwd", () => {
    const r = resolveInstallRoot({
      env: {},
      cwd: () => FAKE_TARGET,
    });
    assert.strictEqual(r.root, FAKE_TARGET);
    assert.strictEqual(r.source, "cwd");
  });

  it("相对路径会被 resolve 成绝对路径", () => {
    const r = resolveInstallRoot({
      targetDir: ".",
      cwd: () => FAKE_TARGET,
    });
    // resolve(".") 用 process.cwd()，可能跟 cwd() 返回不一样
    // 这里只校验返回的是绝对路径
    assert.ok(/^([a-zA-Z]:[\\/]|[\\/])/.test(r.root), `expected absolute path, got: ${r.root}`);
    assert.strictEqual(r.source, "target-dir");
  });
});
