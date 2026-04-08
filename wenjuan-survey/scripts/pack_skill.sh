#!/usr/bin/env bash
# 将 wenjuan-survey skill 打成分发 zip（不含 node_modules、examples、downloads、不含本地 .wenjuan 凭证）
# 输出：上一级目录下的 wenjuan-survey-skill-<package.json version>.zip
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PARENT="$(cd "$SKILL_ROOT/.." && pwd)"
NAME="$(basename "$SKILL_ROOT")"
VERSION="$(cd "$SKILL_ROOT" && node -p "require('./package.json').version")"
OUT="$PARENT/wenjuan-survey-skill-${VERSION}.zip"

cd "$PARENT"
rm -f "$OUT"
# 排除 examples、downloads 下任意层级（勿用 **：部分 zip 会留下空目录）
zip -rq "$OUT" "$NAME" \
  -x "${NAME}/node_modules/*" \
  -x "${NAME}/examples/*" \
  -x "${NAME}/examples/*/*" \
  -x "${NAME}/examples/*/*/*" \
  -x "${NAME}/examples/*/*/*/*" \
  -x "${NAME}/downloads/*" \
  -x "${NAME}/downloads/*/*" \
  -x "${NAME}/downloads/*/*/*" \
  -x "${NAME}/downloads/*/*/*/*" \
  -x "${NAME}/.wenjuan/*" \
  -x "${NAME}/.idea/*" \
  -x "*.DS_Store" \
  -x "**/.DS_Store" \
  -x "**/.git/**"

if unzip -l "$OUT" | grep -E "${NAME}/examples/"; then
  echo "错误: 压缩包内仍含 examples，请检查 pack_skill.sh 排除规则" >&2
  exit 1
fi
if unzip -l "$OUT" | grep -E "${NAME}/downloads/"; then
  echo "错误: 压缩包内仍含 downloads，请检查 pack_skill.sh 排除规则" >&2
  exit 1
fi

echo "已生成: $OUT"
ls -lh "$OUT"
