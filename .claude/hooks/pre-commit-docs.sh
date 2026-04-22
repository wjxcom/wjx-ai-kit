#!/bin/bash
# pre-commit-docs.sh — 提交前：
#   1) 同步 .md 中的动态数字/版本到当前真实值（sync-docs-vars.js）
#   2) 若 wjx-docs/*.md 有暂存改动，重建 wjx-kit.html（build-docs-html.js）
# 由 .claude/settings.json 的 PreToolUse hook 触发（匹配 git commit）

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

# ---- 1) 同步动态数字 / 版本 ----
if node .claude/scripts/sync-docs-vars.js >&2; then
  # 把同步后有变化的文件加回暂存（覆盖范围：wjx-docs/*.md、根 README.md）
  git diff --name-only -- 'wjx-docs/*.md' README.md 2>/dev/null | while read -r f; do
    [ -n "$f" ] && git add -- "$f"
  done
else
  echo "[hook] sync-docs-vars 失败，跳过" >&2
fi

# ---- 2) wjx-docs/*.md 有改动则重建单页 HTML ----
STAGED_MD=$(git diff --cached --name-only -- 'wjx-docs/*.md' 2>/dev/null)

if [ -z "$STAGED_MD" ]; then
  exit 0
fi

echo "[hook] wjx-docs 有 md 文件变更，重建 wjx-kit.html ..." >&2

if node .claude/scripts/build-docs-html.js >&2; then
  git add wjx-docs/wjx-kit.html
  echo "[hook] wjx-kit.html 已重建并暂存" >&2
else
  echo "[hook] wjx-kit.html 构建失败，跳过" >&2
fi

exit 0
