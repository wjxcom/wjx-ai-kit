#!/bin/bash
# Rebuild both generated artifacts whenever a canonical Markdown page changes.
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

if ! git diff --cached --name-only -- wjx-docs | grep -q '\.md$'; then
  exit 0
fi

echo "[hook] canonical docs changed; rebuilding HTML artifacts ..." >&2
if node .claude/scripts/build-docs-html.js >&2; then
  git add wjx-docs/wjx-kit.html wjx-docs/wjx-kit.fragment.html
  echo "[hook] wjx-kit.html and wjx-kit.fragment.html staged" >&2
else
  echo "[hook] documentation build failed" >&2
  exit 1
fi
