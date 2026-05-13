#!/usr/bin/env bash
# 将 wjx-survey-ppt skill 打成分发 zip
# 输出：上一级目录下的 wjx-survey-ppt-skill-<version>.zip
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$SCRIPT_DIR"
PARENT="$(cd "$SKILL_ROOT/.." && pwd)"
NAME="$(basename "$SKILL_ROOT")"
VERSION="$(cd "$SKILL_ROOT" && node -p "require('./package.json').version" 2>/dev/null || echo '0.0.0')"
OUT="$PARENT/wjx-survey-ppt-skill-${VERSION}.zip"

cd "$PARENT"
rm -f "$OUT"

# 排除项：构建产物、缓存、demo 输出、隐藏配置
EXCLUDES=(
  "${NAME}/__pycache__/*"
  "${NAME}/scripts/__pycache__/*"
  "${NAME}/.git/*"
  "${NAME}/.wjxrc"
  "${NAME}/examples/*/out*/*"
  "${NAME}/survey-ppt-workdir/*"
  "*.DS_Store"
  "**/.DS_Store"
  "**/*.pyc"
)

if command -v zip &>/dev/null; then
  EXCLUDE_ARGS=()
  for pattern in "${EXCLUDES[@]}"; do
    EXCLUDE_ARGS+=(-x "$pattern")
  done
  zip -rq "$OUT" "$NAME" "${EXCLUDE_ARGS[@]}"
elif [[ "${OSTYPE:-}" == msys* || "${OSTYPE:-}" == cygwin* ]] && [ -x "/c/Windows/System32/tar.exe" ]; then
  EXCLUDE_ARGS=()
  for pattern in __pycache__ .git .wjxrc out out-warm out-minimal out-soft survey-ppt-workdir .DS_Store; do
    EXCLUDE_ARGS+=("--exclude=$pattern")
  done
  /c/Windows/System32/tar.exe -acf "$OUT" "${EXCLUDE_ARGS[@]}" -C "$PARENT" "$NAME"
elif command -v tar &>/dev/null; then
  EXCLUDE_ARGS=()
  for pattern in __pycache__ .git .wjxrc out out-warm out-minimal out-soft survey-ppt-workdir .DS_Store; do
    EXCLUDE_ARGS+=("--exclude=$pattern")
  done
  tar -acf "$OUT" "${EXCLUDE_ARGS[@]}" -C "$PARENT" "$NAME"
else
  echo "错误: 未找到 zip 或 tar，无法打包" >&2
  exit 1
fi

echo "已生成: $OUT"
ls -lh "$OUT"
