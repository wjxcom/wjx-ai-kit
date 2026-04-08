#!/bin/bash
# pre-commit-docs.sh — 提交前检查 wjx-docs/*.md 是否有改动，有则重建 wjx-kit.html
# 由 .claude/settings.json 的 PreToolUse hook 触发（匹配 git commit）

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

# 检查暂存区是否包含 wjx-docs/*.md 的改动
STAGED_MD=$(git diff --cached --name-only -- 'wjx-docs/*.md' 2>/dev/null)

if [ -z "$STAGED_MD" ]; then
  exit 0
fi

echo "[hook] wjx-docs 有 md 文件变更，重建 wjx-kit.html ..." >&2

# 运行构建
if node scripts/build-docs-html.js >&2; then
  git add wjx-docs/wjx-kit.html
  echo "[hook] wjx-kit.html 已重建并暂存" >&2
else
  echo "[hook] wjx-kit.html 构建失败，跳过" >&2
fi

exit 0
