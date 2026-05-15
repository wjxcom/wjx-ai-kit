#!/bin/bash
#
# wjx-survey-ppt skill 环境检测与安装脚本
# 检测 Python 3.10+ → pip install ppt-master-survey → 验证 wjx-cli
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# 选定 python 命令（优先 python3，回退到 python）
detect_python() {
    if command -v python3 &>/dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &>/dev/null; then
        PYTHON_CMD="python"
    else
        print_error "未检测到 Python"
        return 1
    fi

    PY_VERSION=$($PYTHON_CMD --version 2>&1 | awk '{print $2}')
    PY_MAJOR=$(echo "$PY_VERSION" | cut -d'.' -f1)
    PY_MINOR=$(echo "$PY_VERSION" | cut -d'.' -f2)

    if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]; }; then
        print_error "Python 版本过低: $PY_VERSION（需要 3.10+）"
        return 1
    fi

    print_success "Python $PY_VERSION ($PYTHON_CMD)"
    return 0
}

print_python_install_guide() {
    echo ""
    echo "请安装 Python 3.10+ 后重新运行本脚本："
    echo ""
    echo "  macOS:    brew install python@3.12"
    echo "  Ubuntu:   sudo apt install python3.12 python3.12-venv python3-pip"
    echo "  Windows:  winget install Python.Python.3.12"
    echo "  通用:     https://www.python.org/downloads/"
    echo ""
}

check_pip() {
    if $PYTHON_CMD -m pip --version &>/dev/null; then
        PIP_VER=$($PYTHON_CMD -m pip --version | awk '{print $2}')
        print_success "pip $PIP_VER"
        return 0
    fi
    print_error "pip 未安装。请运行：$PYTHON_CMD -m ensurepip --upgrade"
    return 1
}

install_renderer() {
    print_info "安装 ppt-master-survey（渲染引擎）..."

    if $PYTHON_CMD -c "import ppt_master_survey" &>/dev/null; then
        VER=$($PYTHON_CMD -c "import ppt_master_survey; print(ppt_master_survey.__version__)" 2>/dev/null || echo "?")
        print_success "ppt-master-survey 已安装 ($VER)"
        if [ "$AUTO_INSTALL" -eq 1 ]; then
            return 0
        fi
        echo "  是否升级到最新版？(y/N)"
        read -r choice
        if [[ "$choice" != "y" && "$choice" != "Y" ]]; then
            return 0
        fi
    fi

    if $PYTHON_CMD -m pip install --upgrade ppt-master-survey; then
        print_success "ppt-master-survey 安装成功"
        return 0
    fi

    print_error "ppt-master-survey 安装失败"
    echo "  请手动安装：$PYTHON_CMD -m pip install ppt-master-survey"
    return 1
}

check_wjx_cli() {
    if command -v wjx &>/dev/null; then
        WJX_VER=$(wjx --version 2>/dev/null || echo "unknown")
        print_success "wjx-cli $WJX_VER"
        if [ -f "$HOME/.wjxrc" ]; then
            print_success "~/.wjxrc 已配置"
        else
            print_warning "~/.wjxrc 未配置（运行 wjx init 配置 API Key）"
        fi
        return 0
    fi
    print_warning "未检测到 wjx-cli"
    echo "  本 skill 需配合 wjx-cli 使用，请先安装："
    echo "    npm install -g wjx-cli"
    echo "  详见 wjx-cli-use skill。"
    return 1
}

verify_renderer() {
    print_info "验证渲染引擎..."
    if $PYTHON_CMD -m ppt_master_survey --help &>/dev/null; then
        print_success "ppt-master-svg2pptx 命令可用"
        return 0
    fi
    print_error "渲染引擎调用失败"
    return 1
}

# jieba 是 P08 词云分词的可选依赖；缺失会回退到 N-gram，质量降级但不阻塞主流程。
install_jieba() {
    print_info "安装 jieba（中文分词，用于 P08 词云）..."
    if $PYTHON_CMD -c "import jieba" &>/dev/null; then
        print_success "jieba 已安装"
        return 0
    fi
    if $PYTHON_CMD -m pip install jieba; then
        print_success "jieba 安装成功"
        return 0
    fi
    print_warning "jieba 安装失败，词云将回退到 N-gram 分词（质量降级，不影响 PPT 生成）"
    return 0
}

show_help() {
    cat << EOF
wjx-survey-ppt skill 环境安装脚本

用法: $0 [选项]

选项:
    -h, --help          显示帮助信息
    -y, --yes           自动安装（无需确认）
    -c, --check         仅检查环境，不安装
    -v, --verify        验证安装

示例:
    $0                  # 交互式安装
    $0 -y               # 自动安装
    $0 -c               # 仅检查环境

安装流程:
    1. 检测 Python 3.10+
    2. pip install ppt-master-survey
    3. 检查 wjx-cli 是否安装
    4. 验证渲染引擎可调用

EOF
}

check_only() {
    echo ""
    echo "============================================"
    echo "  wjx-survey-ppt 环境检查"
    echo "============================================"
    echo ""

    PASS=1
    detect_python || PASS=0
    [ $PASS -eq 1 ] && { check_pip || PASS=0; }
    [ $PASS -eq 1 ] && verify_renderer || PASS=0
    check_wjx_cli || PASS=0

    echo ""
    if [ $PASS -eq 1 ]; then
        print_success "环境检查通过"
        exit 0
    else
        print_error "环境检查未通过"
        exit 1
    fi
}

verify_only() {
    echo ""
    echo "============================================"
    echo "  wjx-survey-ppt 安装验证"
    echo "============================================"
    echo ""

    detect_python || exit 1
    verify_renderer || exit 1
    check_wjx_cli
    echo ""
    print_success "验证完成"
}

main() {
    echo ""
    echo "============================================"
    echo "  wjx-survey-ppt 环境安装"
    echo "============================================"
    echo ""

    CHECK_ONLY=0
    AUTO_INSTALL=0
    VERIFY_ONLY=0

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help) show_help; exit 0 ;;
            -c|--check) CHECK_ONLY=1; shift ;;
            -y|--yes) AUTO_INSTALL=1; shift ;;
            -v|--verify) VERIFY_ONLY=1; shift ;;
            *) print_error "未知选项: $1"; show_help; exit 1 ;;
        esac
    done

    if [ $CHECK_ONLY -eq 1 ]; then check_only; exit $?; fi
    if [ $VERIFY_ONLY -eq 1 ]; then verify_only; exit $?; fi

    if ! detect_python; then print_python_install_guide; exit 1; fi
    check_pip || exit 1
    install_renderer || exit 1
    verify_renderer || exit 1
    install_jieba          # best-effort，失败不阻塞
    check_wjx_cli || true   # 不强制阻塞

    echo ""
    echo "============================================"
    print_success "安装完成！"
    echo "============================================"
    echo ""
    echo "  试试对 AI 说："
    echo "  「把问卷 12345 做成 PPT 报告」"
    echo "  「这份 NPS 问卷出一份温暖风格的报告」"
    echo "  「把上周的满意度调查生成极简黑白幻灯片」"
    echo ""
}

main "$@"
