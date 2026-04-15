#!/usr/bin/env bash
# 将 wjx-cli-use skill 打成分发 zip（不含 node_modules、.git、.wjxrc）
# 输出：上一级目录下的 wjx-cli-use-skill-<version>.zip
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$SCRIPT_DIR"
PARENT="$(cd "$SKILL_ROOT/.." && pwd)"
NAME="$(basename "$SKILL_ROOT")"
REPO_ROOT="$(cd "$SKILL_ROOT/../.." && pwd)"
VERSION="$(cd "$REPO_ROOT" && node -p "require('./wjx-cli/package.json').version" 2>/dev/null || echo '0.0.0')"
OUT="$PARENT/wjx-cli-use-skill-${VERSION}.zip"

cd "$PARENT"
rm -f "$OUT"

if command -v zip &>/dev/null; then
  zip -rq "$OUT" "$NAME" \
    -x "${NAME}/node_modules/*" \
    -x "${NAME}/.git/*" \
    -x "${NAME}/.wjxrc" \
    -x "*.DS_Store" \
    -x "**/.DS_Store"
elif [[ "${OSTYPE:-}" == msys* || "${OSTYPE:-}" == cygwin* ]] && [ -x "/c/Windows/System32/tar.exe" ]; then
  # Windows Git Bash: 自带的 GNU tar 不支持 zip 格式，改用 Windows 原生 bsdtar
  /c/Windows/System32/tar.exe -acf "$OUT" --exclude=node_modules --exclude=.git --exclude=.wjxrc --exclude=.DS_Store -C "$PARENT" "$NAME"
elif command -v tar &>/dev/null; then
  # macOS / Linux: bsdtar 或 GNU tar >= 1.31 支持 -a 自动检测 zip
  tar -acf "$OUT" --exclude='node_modules' --exclude='.git' --exclude='.wjxrc' --exclude='.DS_Store' -C "$PARENT" "$NAME"
else
  echo "错误: 未找到 zip 或 tar，无法打包" >&2
  exit 1
fi

echo "已生成: $OUT"
ls -lh "$OUT"
