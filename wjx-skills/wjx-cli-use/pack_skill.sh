#!/usr/bin/env bash
# 将 wjx-cli-use skill 打成分发 zip（不含 node_modules、.git、.wjxrc）
# 输出：上一级目录下的 wjx-cli-use-skill-<version>.zip
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$SCRIPT_DIR"
PARENT="$(cd "$SKILL_ROOT/.." && pwd)"
NAME="$(basename "$SKILL_ROOT")"
VERSION="$(node -p "require('$SKILL_ROOT/package.json').version" 2>/dev/null || echo '1.0.0')"
OUT="$PARENT/wjx-cli-use-skill-${VERSION}.zip"

cd "$PARENT"
rm -f "$OUT"

zip -rq "$OUT" "$NAME" \
  -x "${NAME}/node_modules/*" \
  -x "${NAME}/.git/*" \
  -x "${NAME}/.wjxrc" \
  -x "*.DS_Store" \
  -x "**/.DS_Store"

echo "已生成: $OUT"
ls -lh "$OUT"
