#!/bin/bash
#
# 问卷星 AI Skill 环境检测与安装脚本
# 检测 Node.js → 安装 wjx-cli → 引导获取 API Key → 配置 → 验证
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 打印函数
print_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# 检测操作系统
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            OS=$NAME
        else
            OS="Linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macOS"
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        OS="Windows"
    else
        OS="Unknown"
    fi
    echo "$OS"
}

# Step 1: 检测 Node.js
check_node() {
    print_info "Step 1/5: 检测 Node.js 环境..."

    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d'v' -f2 | cut -d'.' -f1)

        if [ "$NODE_MAJOR" -ge 20 ]; then
            print_success "Node.js $NODE_VERSION"
            return 0
        else
            print_error "Node.js 版本过低: $NODE_VERSION（需要 20+）"
            return 1
        fi
    else
        print_error "未检测到 Node.js"
        return 1
    fi
}

# 打印 Node.js 安装指引
print_node_install_guide() {
    echo ""
    echo "请安装 Node.js 20+ 后重新运行本脚本："
    echo ""
    echo "  macOS:    brew install node"
    echo "  Ubuntu:   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "  CentOS:   curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo yum install -y nodejs"
    echo "  Windows:  winget install OpenJS.NodeJS"
    echo "  通用:     https://nodejs.org 下载安装"
    echo ""
}

# Step 2: 安装 wjx-cli
install_cli() {
    print_info "Step 2/5: 安装 wjx-cli..."

    if command -v wjx &> /dev/null; then
        WJX_VERSION=$(wjx --version 2>/dev/null || echo "unknown")
        print_success "wjx-cli 已安装 ($WJX_VERSION)"
        return 0
    fi

    print_info "正在全局安装 wjx-cli..."
    NPM_ERR=$(mktemp)
    if npm install -g wjx-cli 2>"$NPM_ERR"; then
        rm -f "$NPM_ERR"
        print_success "wjx-cli 安装成功"
        return 0
    else
        print_warning "全局安装失败，错误信息："
        cat "$NPM_ERR" 2>/dev/null
        rm -f "$NPM_ERR"
        print_info "尝试 sudo..."
        if command -v sudo &> /dev/null; then
            if sudo npm install -g wjx-cli; then
                print_success "wjx-cli 安装成功（sudo）"
                return 0
            fi
        fi
        echo ""
        print_error "wjx-cli 安装失败"
        echo ""
        echo "请手动安装："
        echo "  sudo npm install -g wjx-cli"
        echo ""
        echo "或使用 npx 免安装运行："
        echo "  npx wjx-cli survey list"
        echo ""
        return 1
    fi
}

# Step 3: 引导获取 API Key
guide_api_key() {
    print_info "Step 3/5: 获取问卷星 API Key..."

    LOGIN_URL="https://www.wjx.cn/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1"

    echo ""
    echo "  即将打开浏览器，请用微信扫码登录问卷星。"
    echo "  登录后会自动跳转到 API Key 管理页面，复制你的 API Key。"
    echo ""

    # 尝试打开浏览器
    OPENED=0
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "$LOGIN_URL" 2>/dev/null && OPENED=1
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        cmd.exe /c start "" "$LOGIN_URL" 2>/dev/null && OPENED=1
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$LOGIN_URL" 2>/dev/null && OPENED=1
    fi

    if [ $OPENED -eq 0 ]; then
        print_warning "无法自动打开浏览器，请手动复制以下链接到浏览器打开："
        echo ""
        echo "  $LOGIN_URL"
        echo ""
    else
        print_success "已打开浏览器"
    fi

    echo "  请在浏览器页面复制 API Key，然后继续下一步。"
    echo ""
    if [ $AUTO_INSTALL -eq 0 ]; then
        read -p "  按回车键继续..." -r
    fi
}

# Step 4: 配置 wjx-cli
configure_cli() {
    print_info "Step 4/5: 配置 wjx-cli..."
    echo ""
    echo "  请将刚才复制的 API Key 粘贴到下方："
    echo ""
    wjx init
}

# Step 5: 验证
verify_setup() {
    print_info "Step 5/5: 验证连接..."
    wjx doctor
}

# 仅检查环境
check_only() {
    echo ""
    echo "============================================"
    echo "  问卷星 AI Skill 环境检查"
    echo "============================================"
    echo ""

    PASS=1

    # Node.js
    if check_node; then true; else PASS=0; fi

    # npm
    if command -v npm &> /dev/null; then
        print_success "npm $(npm --version)"
    else
        print_error "未检测到 npm"
        PASS=0
    fi

    # wjx-cli
    if command -v wjx &> /dev/null; then
        print_success "wjx-cli $(wjx --version 2>/dev/null || echo 'installed')"
    else
        print_warning "wjx-cli 未安装（运行 npm install -g wjx-cli）"
        PASS=0
    fi

    # ~/.wjxrc
    if [ -f "$HOME/.wjxrc" ]; then
        print_success "~/.wjxrc 配置文件存在"
    else
        print_warning "~/.wjxrc 未配置（运行 wjx init）"
    fi

    echo ""
    if [ $PASS -eq 1 ]; then
        print_success "环境检查通过"
        exit 0
    else
        print_error "环境检查未通过"
        exit 1
    fi
}

# 仅验证
verify_only() {
    echo ""
    echo "============================================"
    echo "  问卷星 AI Skill 安装验证"
    echo "============================================"
    echo ""

    check_node || exit 1

    if command -v wjx &> /dev/null; then
        print_success "wjx-cli $(wjx --version 2>/dev/null || echo 'installed')"
    else
        print_error "wjx-cli 未安装"
        exit 1
    fi

    echo ""
    wjx doctor
}

# 显示帮助
show_help() {
    cat << EOF
问卷星 AI Skill 环境检测与安装脚本

用法: $0 [选项]

选项:
    -h, --help      显示帮助信息
    -y, --yes       自动安装（无需确认，推荐）
    -c, --check     仅检查环境，不安装
    -v, --verify    验证安装是否完整

示例:
    $0              # 交互式安装
    $0 -y           # 自动安装（推荐）
    $0 -c           # 仅检查环境
    $0 -v           # 验证安装

安装流程:
    1. 检测 Node.js 20+
    2. 安装 wjx-cli（npm install -g wjx-cli）
    3. 打开浏览器获取 API Key（微信扫码登录）
    4. 配置 wjx init（粘贴 API Key）
    5. 验证连接 wjx doctor

EOF
}

# 主函数
main() {
    echo ""
    echo "============================================"
    echo "  问卷星 AI Skill 环境安装"
    echo "============================================"
    echo ""

    # 解析参数
    CHECK_ONLY=0
    AUTO_INSTALL=0
    VERIFY_ONLY=0

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -c|--check)
                CHECK_ONLY=1
                shift
                ;;
            -y|--yes)
                AUTO_INSTALL=1
                shift
                ;;
            -v|--verify)
                VERIFY_ONLY=1
                shift
                ;;
            *)
                print_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # 仅检查模式
    if [ $CHECK_ONLY -eq 1 ]; then
        check_only
        exit $?
    fi

    # 仅验证模式
    if [ $VERIFY_ONLY -eq 1 ]; then
        verify_only
        exit $?
    fi

    # Step 1: Node.js
    if ! check_node; then
        print_node_install_guide
        exit 1
    fi

    # Step 2: wjx-cli
    if ! install_cli; then
        exit 1
    fi

    # Step 3: API Key
    guide_api_key

    # Step 4: 配置
    configure_cli

    # Step 5: 验证
    echo ""
    verify_setup

    echo ""
    echo "============================================"
    print_success "安装完成！"
    echo "============================================"
    echo ""
    echo "  试试对 AI 说："
    echo "  「帮我创建一份客户满意度调查问卷」"
    echo ""
    echo "  或命令行直接用："
    echo "  wjx survey list                    # 查看问卷列表"
    echo "  wjx survey create-by-text --text . # 用文本创建问卷"
    echo "  wjx response report --vid 12345    # 查看问卷报告"
    echo ""
}

main "$@"
