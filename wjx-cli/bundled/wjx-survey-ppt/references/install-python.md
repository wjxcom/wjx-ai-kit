# 安装 Python 3.10+

skill 渲染层依赖 ppt-master-survey（PyPI），需要 Python 3.10 或以上。

## 检测当前版本

```bash
python --version       # Windows
python3 --version      # macOS / Linux
```

输出 `Python 3.10.x` 以上即可。低于 3.10 或未安装则按下方安装。

## Windows

**推荐：从 python.org 安装**
1. 打开 https://www.python.org/downloads/
2. 下载最新稳定版（建议 3.12+）
3. 安装时**务必勾选 "Add python.exe to PATH"**
4. 重开终端，跑 `python --version` 验证

**或用 winget**
```powershell
winget install Python.Python.3.12
```

## macOS

**推荐：用 Homebrew**
```bash
brew install python@3.12
```

**或从 python.org 下 .pkg 安装包**

注意：macOS 自带的 `python3` 通常是系统旧版，安装新版后用 `python3.12` 调用。

## Linux

**Ubuntu / Debian**
```bash
sudo apt update
sudo apt install -y python3.12 python3.12-venv python3-pip
```

**CentOS / RHEL**
```bash
sudo dnf install -y python3.12
```

**Arch / Manjaro**
```bash
sudo pacman -S python
```

## 验证

```bash
python --version              # 应输出 3.10+
python -m pip --version       # 应输出 pip 版本
```

## 装完 Python 后下一步

```bash
pip install ppt-master-survey
```

验证：`ppt-master-svg2pptx --help` 应输出帮助信息。
