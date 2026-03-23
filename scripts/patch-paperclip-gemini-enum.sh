#!/usr/bin/env bash
# 为 Paperclip 2026.318.0 补齐 API 枚举中的 gemini_local（见 docs/paperclip-gemini-local.md）
set -euo pipefail
python3 << 'PY'
from pathlib import Path
import os
root = Path(os.path.expanduser("~/.npm/_npx"))
needle = '    "hermes_local",\n]'
repl = '    "hermes_local",\n    "gemini_local",\n]'
patched = 0
for f in root.glob("**/node_modules/@paperclipai/shared/dist/constants.js"):
    text = f.read_text(encoding="utf-8")
    if '"gemini_local"' in text:
        print(f"skip (already patched): {f}")
        continue
    if needle not in text:
        print(f"skip (pattern mismatch): {f}")
        continue
    f.write_text(text.replace(needle, repl, 1), encoding="utf-8")
    print(f"patched: {f}")
    patched += 1
if patched == 0:
    raise SystemExit("No file patched. Run: cd ~/.paperclip && npx paperclipai --version")
print("Restart Paperclip: stop paperclipai run, then npx paperclipai run -i default")
PY
